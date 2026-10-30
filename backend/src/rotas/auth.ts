import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { poolAuth } from '../db/poolAuth.js'
import { conferirSenha } from '../auth/senha.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { gerarTokenAcesso, gerarTokenRefresh, verificarTokenRefresh } from '../auth/jwt.js'
import { assincrono } from '../lib/assincrono.js'

export const rotasAuth = Router()

// 10 tentativas a cada 15 minutos, por IP — alto o bastante pra não
// atrapalhar alguém errando a senha duas vezes, baixo o bastante pra
// inviabilizar um ataque de força bruta na prática.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.' },
})

const corpoLogin = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1),
})

/**
 * Login é o único lugar do sistema que busca por e-mail sem saber ainda de
 * qual conta é — por isso usa `poolAuth` (role `app_auth`), não o pool
 * comum. Depois de autenticar, toda outra rota já sabe a conta e usa o
 * caminho normal.
 *
 * A mensagem de erro é a mesma pra "e-mail não existe" e "senha errada" —
 * diferenciar ajudaria alguém testando e-mails em massa a descobrir quais
 * existem no sistema.
 */
rotasAuth.post('/login', limiteLogin, assincrono(async (req, res) => {
  const corpo = corpoLogin.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'E-mail ou senha em formato inválido.' })
    return
  }

  const { email, senha } = corpo.data

  const { rows } = await poolAuth.query<{
    id: string
    conta_id: string
    senha_hash: string
    role: 'admin' | 'operador'
    ativo: boolean
    email_confirmado_em: Date | null
  }>(
    'select id, conta_id, senha_hash, role, ativo, email_confirmado_em from lojas where email = $1',
    [email],
  )

  const login = rows[0]
  const senhaConfere = login ? await conferirSenha(senha, login.senha_hash) : false

  // Roda o bcrypt mesmo quando o e-mail não existe (comparando contra uma
  // string qualquer) — sem isso, a resposta de "e-mail não existe" chega
  // mais rápido que a de "senha errada", e esse tempo de resposta sozinho
  // já diz pra quem está testando se o e-mail existe ou não.
  if (!login) await conferirSenha(senha, '$2a$12$' + '0'.repeat(53))

  if (!login || !senhaConfere || !login.ativo) {
    res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
    return
  }

  // Depois de conferir a senha, não antes: dizer "confirme seu e-mail" pra
  // quem errou a senha mostraria que o e-mail existe. Quem chega aqui provou
  // que é dono da conta, então a explicação é segura.
  if (!login.email_confirmado_em) {
    res.status(403).json({
      codigo: 'email_nao_confirmado',
      erro: 'Confirme seu e-mail para entrar. Procure o link na sua caixa de entrada.',
    })
    return
  }

  const sessao = {
    contaId: login.conta_id,
    lojaId: login.role === 'admin' ? null : login.id,
    role: login.role,
  }

  res.json({
    accessToken: gerarTokenAcesso(login.id, sessao),
    refreshToken: gerarTokenRefresh(login.id),
  })
}))

const corpoRefresh = z.object({
  refreshToken: z.string().min(1),
})

/**
 * Troca um refresh token válido por um access token novo. Não confia no
 * que estava no token antigo — busca de novo no banco, porque o papel ou
 * o status (ativo/inativo) do login pode ter mudado desde que ele foi
 * emitido.
 */
const limiteRefresh = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

rotasAuth.post('/refresh', limiteRefresh, assincrono(async (req, res) => {
  const corpo = corpoRefresh.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Corpo inválido.' })
    return
  }

  const payload = verificarTokenRefresh(corpo.data.refreshToken)
  if (!payload) {
    res.status(401).json({ erro: 'Refresh token inválido ou expirado.' })
    return
  }

  const { rows } = await poolAuth.query<{
    id: string
    conta_id: string
    role: 'admin' | 'operador'
    ativo: boolean
    senha_alterada_em: Date
  }>('select id, conta_id, role, ativo, senha_alterada_em from lojas where id = $1', [
    payload.sub,
  ])

  const login = rows[0]
  if (!login || !login.ativo) {
    res.status(401).json({ erro: 'Login não encontrado ou desativado.' })
    return
  }

  // Trocar a senha encerra as sessões abertas: um refresh token emitido ANTES
  // da troca não vale mais. É o que faz "esqueci minha senha" servir também
  // pra expulsar quem tinha roubado a sessão. A folga existe porque o relógio
  // do banco (que grava a data) e o do servidor (que grava o `iat` do token)
  // não são o mesmo — sem ela, um token emitido logo depois da troca podia ser
  // recusado por alguns segundos de diferença.
  const FOLGA_DE_RELOGIO_EM_SEGUNDOS = 10
  const trocouEm = Math.floor(login.senha_alterada_em.getTime() / 1000)
  if ((payload.iat ?? 0) < trocouEm - FOLGA_DE_RELOGIO_EM_SEGUNDOS) {
    res.status(401).json({ erro: 'Sessão encerrada: a senha foi alterada. Entre de novo.' })
    return
  }

  const sessao = {
    contaId: login.conta_id,
    lojaId: login.role === 'admin' ? null : login.id,
    role: login.role,
  }

  res.json({ accessToken: gerarTokenAcesso(login.id, sessao) })
}))

/**
 * Dados de perfil (nome/e-mail/role) de quem está logado.
 *
 * Não entra no JWT de propósito: o token vive até 15 minutos, e nome/e-mail
 * podem mudar nesse meio-tempo (o próprio usuário editando o perfil, por
 * exemplo) — colocar esses campos no token faria a tela mostrar um nome
 * desatualizado até o token expirar. Como o token já expira rápido, buscar
 * de novo aqui é mais barato que resolver esse caso de borda.
 *
 * Usa `poolAuth`, não o pool comum: é a mesma tabela (`lojas`) da busca de
 * login, e a sessão aqui dentro ainda não setou app.conta_id — pedir pro
 * usuário logado reconfirmar sozinho via contexto normal duplicaria a
 * conexão por nada.
 */
rotasAuth.get('/me', exigirAutenticacao, assincrono(async (req, res) => {
  const { rows } = await poolAuth.query<{
    id: string
    nome: string
    email: string
    role: 'admin' | 'operador'
  }>('select id, nome, email, role from lojas where id = $1', [req.loginId])

  const login = rows[0]
  if (!login) {
    res.status(401).json({ erro: 'Login não encontrado.' })
    return
  }

  res.json(login)
}))
