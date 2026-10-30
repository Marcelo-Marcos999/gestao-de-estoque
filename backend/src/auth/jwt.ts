import jwt from 'jsonwebtoken'
import type { SessaoUsuario } from '../db/contexto.js'

const SEGREDO_ACESSO = exigirVariavel('JWT_ACCESS_SECRET')
const SEGREDO_REFRESH = exigirVariavel('JWT_REFRESH_SECRET')

// Curto de propósito: um token de acesso vazado (log, extensão de
// navegador maliciosa, o que for) expira sozinho rápido. Quem continua
// logado usa o refresh pra pegar um novo, sem digitar senha de novo.
const DURACAO_ACESSO = '15m'
const DURACAO_REFRESH = '7d'

function exigirVariavel(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`${nome} não definida. Veja .env.example.`)
  return valor
}

interface PayloadAcesso extends SessaoUsuario {
  sub: string // id do login (lojas.id ou administradores_plataforma.id)
  tipo: 'acesso'
}

interface PayloadRefresh {
  sub: string
  tipo: 'refresh'
  /** Quando foi emitido (segundos). A biblioteca de JWT preenche sozinha. */
  iat?: number
}

export function gerarTokenAcesso(loginId: string, sessao: SessaoUsuario): string {
  const payload: PayloadAcesso = { sub: loginId, tipo: 'acesso', ...sessao }
  return jwt.sign(payload, SEGREDO_ACESSO, { expiresIn: DURACAO_ACESSO })
}

export function gerarTokenRefresh(loginId: string): string {
  const payload: PayloadRefresh = { sub: loginId, tipo: 'refresh' }
  return jwt.sign(payload, SEGREDO_REFRESH, { expiresIn: DURACAO_REFRESH })
}

/** Devolve null em vez de lançar — token inválido/expirado é esperado, não exceção. */
export function verificarTokenAcesso(token: string): PayloadAcesso | null {
  try {
    const payload = jwt.verify(token, SEGREDO_ACESSO)
    if (typeof payload === 'string' || payload.tipo !== 'acesso') return null
    return payload as PayloadAcesso
  } catch {
    return null
  }
}

export function verificarTokenRefresh(token: string): PayloadRefresh | null {
  try {
    const payload = jwt.verify(token, SEGREDO_REFRESH)
    if (typeof payload === 'string' || payload.tipo !== 'refresh') return null
    return payload as PayloadRefresh
  } catch {
    return null
  }
}
