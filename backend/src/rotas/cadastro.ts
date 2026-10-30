import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { poolAuth } from '../db/poolAuth.js'
import { gerarHash, validarSenhaNova } from '../auth/senha.js'
import {
  VALIDADE_CONFIRMACAO,
  VALIDADE_REDEFINICAO,
  gerarToken,
  hashDoToken,
} from '../auth/tokensEmail.js'
import { enviarEmail, envioDeEmailAtivo, urlDoApp } from '../email/enviar.js'
import { emailConfirmacao, emailRedefinicaoDeSenha } from '../email/modelos.js'
import { assincrono } from '../lib/assincrono.js'

/**
 * Criar conta, confirmar e-mail e recuperar senha.
 *
 * Tudo aqui roda como `app_auth`, que não tem privilégio novo em tabela
 * nenhuma: cada passo sensível é uma função do banco (ver a migration
 * 1700000000003) que exige o token dentro dela. Esta camada só valida a
 * entrada, gera o token e manda o e-mail.
 *
 * Duas regras valem pra todas as rotas que recebem um e-mail:
 *  - a resposta é a MESMA exista a conta ou não (202), senão estas telas viram
 *    uma lista de e-mails cadastrados;
 *  - o e-mail é enviado sem esperar (`enviarSemEsperar`): esperar deixaria a
 *    resposta de "existe" mais lenta que a de "não existe", e o tempo sozinho
 *    entregaria a diferença.
 */
export const rotasCadastro = Router()

const limitePorIp = (limite: number, janelaMinutos: number) =>
  rateLimit({
    windowMs: janelaMinutos * 60 * 1000,
    limit: limite,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.' },
  })

// Criar conta é o que mais custa (hash de senha + várias linhas no banco) e o
// que mais atrai abuso: bem mais apertado que os outros.
const limiteCadastro = limitePorIp(5, 60)
const limitePedidoDeEmail = limitePorIp(5, 15)
const limiteToken = limitePorIp(20, 15)

/**
 * Sem provedor de e-mail, estas rotas não podem cumprir o que prometem. Melhor
 * dizer isso claramente do que aceitar o pedido e nunca entregar.
 */
function exigirEnvioDeEmail(_req: Request, res: Response, next: NextFunction) {
  if (!envioDeEmailAtivo()) {
    res.status(503).json({
      codigo: 'email_indisponivel',
      erro: 'O envio de e-mail ainda não está ativo neste servidor. Tente mais tarde ou fale com o administrador do sistema.',
    })
    return
  }
  next()
}

function enviarSemEsperar(envio: Promise<void>) {
  // Só a mensagem de erro vai pro log: o e-mail inteiro tem o link.
  envio.catch((erro) => {
    console.error('Falha ao enviar e-mail:', erro instanceof Error ? erro.message : 'erro desconhecido')
  })
}

type TipoToken = 'confirmar-email' | 'redefinir-senha'

/** Registra o token no banco e, havendo pra quem enviar, dispara o e-mail. */
async function emitirTokenEEnviar(email: string, tipo: TipoToken) {
  const token = gerarToken()
  const validade = tipo === 'confirmar-email' ? VALIDADE_CONFIRMACAO : VALIDADE_REDEFINICAO

  const { rows } = await poolAuth.query<{ loja_email: string }>(
    'select loja_email from solicitar_token($1, $2::token_email_tipo, $3, $4::interval)',
    [email, tipo, hashDoToken(token), validade],
  )

  const destino = rows[0]
  if (!destino) return

  // O endereço da página vem de configuração (ver urlDoApp), não da requisição.
  const rota = tipo === 'confirmar-email' ? 'confirmar-email' : 'redefinir-senha'
  const link = `${urlDoApp()}/${rota}?token=${encodeURIComponent(token)}`

  enviarSemEsperar(
    enviarEmail(
      tipo === 'confirmar-email'
        ? emailConfirmacao(destino.loja_email, link)
        : emailRedefinicaoDeSenha(destino.loja_email, link),
    ),
  )
}

const corpoCadastro = z.object({
  nomeEmpresa: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  senha: z.string().max(200),
})

rotasCadastro.post(
  '/cadastro',
  limiteCadastro,
  exigirEnvioDeEmail,
  assincrono(async (req, res) => {
    const corpo = corpoCadastro.safeParse(req.body)
    if (!corpo.success) {
      res.status(400).json({ erro: 'Confira o nome da empresa e o e-mail.' })
      return
    }

    const { nomeEmpresa, email, senha } = corpo.data

    const erroDaSenha = validarSenhaNova(senha)
    if (erroDaSenha) {
      res.status(400).json({ erro: erroDaSenha })
      return
    }

    // O hash é calculado mesmo quando o e-mail já existe: é a parte mais lenta
    // do cadastro, e pular ela nesse caso deixaria a resposta mais rápida.
    const senhaHash = await gerarHash(senha)

    // O resultado (id da loja, ou null se o e-mail já existe) é ignorado de
    // propósito. O pedido de token roda nos dois casos, pelo mesmo caminho:
    // pra e-mail novo manda a confirmação; pra um que já existe e confirmou,
    // `solicitar_token` não devolve ninguém e nada é enviado. Resposta e
    // tempo iguais, então o cadastro não revela quais e-mails existem.
    await poolAuth.query('select criar_conta($1, $2, $3, $4)', [
      nomeEmpresa,
      'Administração',
      email,
      senhaHash,
    ])
    await emitirTokenEEnviar(email, 'confirmar-email')

    res.status(202).json({ ok: true })
  }),
)

const corpoSoEmail = z.object({ email: z.string().trim().toLowerCase().email().max(254) })

// Quem perdeu o primeiro link (ou deixou vencer) pede outro.
rotasCadastro.post(
  '/reenviar-confirmacao',
  limitePedidoDeEmail,
  exigirEnvioDeEmail,
  assincrono(async (req, res) => {
    const corpo = corpoSoEmail.safeParse(req.body)
    if (!corpo.success) {
      res.status(400).json({ erro: 'E-mail inválido. Confira o endereço.' })
      return
    }

    await emitirTokenEEnviar(corpo.data.email, 'confirmar-email')
    res.status(202).json({ ok: true })
  }),
)

rotasCadastro.post(
  '/esqueci-senha',
  limitePedidoDeEmail,
  exigirEnvioDeEmail,
  assincrono(async (req, res) => {
    const corpo = corpoSoEmail.safeParse(req.body)
    if (!corpo.success) {
      res.status(400).json({ erro: 'E-mail inválido. Confira o endereço.' })
      return
    }

    await emitirTokenEEnviar(corpo.data.email, 'redefinir-senha')
    res.status(202).json({ ok: true })
  }),
)

const corpoToken = z.object({ token: z.string().min(20).max(200) })

const RESPOSTA_TOKEN_INVALIDO = {
  codigo: 'token_invalido',
  erro: 'Este link é inválido ou já expirou. Peça um novo.',
}

rotasCadastro.post(
  '/confirmar-email',
  limiteToken,
  assincrono(async (req, res) => {
    const corpo = corpoToken.safeParse(req.body)
    if (!corpo.success) {
      res.status(400).json(RESPOSTA_TOKEN_INVALIDO)
      return
    }

    const { rows } = await poolAuth.query<{ ok: boolean }>(
      'select confirmar_email_com_token($1) as ok',
      [hashDoToken(corpo.data.token)],
    )

    if (!rows[0]?.ok) {
      res.status(400).json(RESPOSTA_TOKEN_INVALIDO)
      return
    }
    res.json({ ok: true })
  }),
)

const corpoRedefinir = z.object({
  token: z.string().min(20).max(200),
  senha: z.string().max(200),
})

rotasCadastro.post(
  '/redefinir-senha',
  limiteToken,
  assincrono(async (req, res) => {
    const corpo = corpoRedefinir.safeParse(req.body)
    if (!corpo.success) {
      res.status(400).json(RESPOSTA_TOKEN_INVALIDO)
      return
    }

    const erroDaSenha = validarSenhaNova(corpo.data.senha)
    if (erroDaSenha) {
      res.status(400).json({ erro: erroDaSenha })
      return
    }

    const { rows } = await poolAuth.query<{ ok: boolean }>(
      'select redefinir_senha_com_token($1, $2) as ok',
      [hashDoToken(corpo.data.token), await gerarHash(corpo.data.senha)],
    )

    if (!rows[0]?.ok) {
      res.status(400).json(RESPOSTA_TOKEN_INVALIDO)
      return
    }
    res.json({ ok: true })
  }),
)
