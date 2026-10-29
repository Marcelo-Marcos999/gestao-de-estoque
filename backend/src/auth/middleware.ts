import type { NextFunction, Request, Response } from 'express'
import type { SessaoUsuario } from '../db/contexto.js'
import { verificarTokenAcesso } from './jwt.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessao?: SessaoUsuario
      loginId?: string
    }
  }
}

/**
 * Exige um token de acesso válido no header Authorization. Sem ele, 401
 * antes de qualquer rota de verdade rodar — nenhuma query no banco chega a
 * acontecer sem sessão identificada.
 */
export function exigirAutenticacao(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.headers.authorization
  if (!cabecalho?.startsWith('Bearer ')) {
    res.status(401).json({ erro: 'Token de acesso ausente.' })
    return
  }

  const token = cabecalho.slice('Bearer '.length)
  const payload = verificarTokenAcesso(token)
  if (!payload) {
    res.status(401).json({ erro: 'Token de acesso inválido ou expirado.' })
    return
  }

  req.loginId = payload.sub
  req.sessao = { contaId: payload.contaId, lojaId: payload.lojaId, role: payload.role }
  next()
}

/** Pra rotas que só o admin da conta pode chamar — roda depois de exigirAutenticacao. */
export function exigirAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.sessao?.role !== 'admin') {
    res.status(403).json({ erro: 'Só o administrador da conta pode fazer isso.' })
    return
  }
  next()
}
