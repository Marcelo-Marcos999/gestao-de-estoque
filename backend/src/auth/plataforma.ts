import type { NextFunction, Request, Response } from 'express'
import { poolAuth } from '../db/poolAuth.js'
import { assincrono } from '../lib/assincrono.js'
import { verificarTokenPlataforma } from './jwt.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Só preenchido nas rotas de /plataforma. */
      adminPlataformaId?: string
    }
  }
}

/**
 * Guarda das rotas de /plataforma: exige o token da plataforma (o de cliente não
 * serve) E que o administrador continue ativo no banco. A segunda conferência
 * custa uma consulta, mas é o que faz desativar um administrador valer na hora,
 * em vez de só quando o token de uma hora vencer.
 */
export const exigirPlataforma = assincrono(async (req: Request, res: Response, next: NextFunction) => {
  const cabecalho = req.headers.authorization
  const payload = cabecalho?.startsWith('Bearer ') ? verificarTokenPlataforma(cabecalho.slice(7)) : null
  if (!payload) {
    res.status(401).json({ erro: 'Sessão da plataforma ausente ou expirada.' })
    return
  }

  const { rows } = await poolAuth.query<{ ativo: boolean }>(
    'select ativo from administradores_plataforma where id = $1',
    [payload.sub],
  )
  if (!rows[0]?.ativo) {
    res.status(401).json({ erro: 'Sessão da plataforma ausente ou expirada.' })
    return
  }

  req.adminPlataformaId = payload.sub
  next()
})
