import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { poolAuth } from '../db/poolAuth.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { gerarTokenAcesso, gerarTokenRefresh } from '../auth/jwt.js'
import { conferirSenha, gerarHash, validarSenhaNova } from '../auth/senha.js'
import { assincrono } from '../lib/assincrono.js'

/** Tudo que quem está logado faz sobre a própria conta. */
export const rotasConta = Router()

rotasConta.use(exigirAutenticacao)

// Conferir a "senha atual" é uma forma de testar senhas: mesmo logado, precisa
// de limite (um token roubado não pode servir pra descobrir a senha).
const limiteTrocaDeSenha = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.' },
})

const corpoAlterarSenha = z.object({
  senhaAtual: z.string().min(1).max(200),
  senhaNova: z.string().max(200),
})

/**
 * Pede a senha atual de novo mesmo com a sessão aberta: sem isso, quem
 * pegasse um celular desbloqueado (ou roubasse um token) trocaria a senha e
 * tomaria a conta.
 *
 * Trocar a senha encerra as outras sessões (o refresh token antigo deixa de
 * valer, ver rotas/auth.ts), então esta resposta devolve tokens novos: sem
 * eles, quem trocou a senha seria o primeiro a ser deslogado.
 */
rotasConta.post(
  '/alterar-senha',
  limiteTrocaDeSenha,
  assincrono(async (req, res) => {
    const corpo = corpoAlterarSenha.safeParse(req.body)
    if (!corpo.success) {
      res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' })
      return
    }

    const { senhaAtual, senhaNova } = corpo.data

    const erroDaSenha = validarSenhaNova(senhaNova)
    if (erroDaSenha) {
      res.status(400).json({ erro: erroDaSenha })
      return
    }

    if (senhaNova === senhaAtual) {
      res.status(400).json({ erro: 'A nova senha precisa ser diferente da atual.' })
      return
    }

    const { rows } = await poolAuth.query<{ senha_hash: string }>(
      'select senha_hash from lojas where id = $1',
      [req.loginId],
    )

    const hashAtual = rows[0]?.senha_hash
    if (!hashAtual || !(await conferirSenha(senhaAtual, hashAtual))) {
      res.status(403).json({ erro: 'A senha atual está incorreta.' })
      return
    }

    const novoHash = await gerarHash(senhaNova)

    // Pelo caminho normal (sob RLS), não pelo do login: a política de `lojas`
    // já decide que cada um só altera a si mesmo (e o admin, a própria conta).
    const alteradas = await comContextoDoUsuario(req.sessao!, async (client) => {
      const { rowCount } = await client.query(
        'update lojas set senha_hash = $1, senha_alterada_em = now() where id = $2',
        [novoHash, req.loginId],
      )
      return rowCount ?? 0
    })

    if (alteradas !== 1) {
      res.status(404).json({ erro: 'Login não encontrado.' })
      return
    }

    res.json({
      accessToken: gerarTokenAcesso(req.loginId!, req.sessao!),
      refreshToken: gerarTokenRefresh(req.loginId!),
    })
  }),
)
