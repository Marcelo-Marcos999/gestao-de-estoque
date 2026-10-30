/**
 * Sessão de login: usuário + os dois tokens JWT (acesso e refresh).
 *
 * Fica em `shared/`, não dentro de `features/auth/`, porque o cliente HTTP
 * (`http.ts`, usado por toda feature que fala com o back-end) precisa ler e
 * renovar o token sem depender de React nem importar de dentro de outra
 * feature — o que o projeto proíbe (ver CLAUDE.md, "Arquitetura").
 */
import { readJson, removeKey, writeJson, storageKey } from './storage'

const KEY = storageKey('session')

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'operador'
}

export interface Session {
  user: SessionUser
  accessToken: string
  refreshToken: string
}

/**
 * Chamado pelo `AuthContext` pra saber quando o refresh token também
 * expirou (ou foi revogado) em algum lugar fora de uma tela — dentro de
 * `http.ts`, no meio de uma chamada qualquer. Sem isto, limpar o storage
 * ali não teria como avisar o React que `user` virou null.
 */
let avisarSessaoExpirada: (() => void) | null = null

export function aoExpirarSessao(callback: (() => void) | null): void {
  avisarSessaoExpirada = callback
}

function kindAtual(): 'local' | 'session' {
  return readJson<Session | null>(KEY, null, 'local') ? 'local' : 'session'
}

export function readSession(): Session | null {
  return readJson<Session | null>(KEY, null, 'local') ?? readJson<Session | null>(KEY, null, 'session')
}

export function writeSession(session: Session, remember: boolean): void {
  writeJson(KEY, session, remember ? 'local' : 'session')
}

/** Só troca o access token, sem tocar no resto — usado depois de um refresh silencioso. */
export function updateAccessToken(accessToken: string): void {
  const atual = readSession()
  if (!atual) return
  writeJson(KEY, { ...atual, accessToken }, kindAtual())
}

/**
 * Troca os dois tokens, depois de uma troca de senha: a troca encerra as
 * outras sessões (o refresh antigo deixa de valer), e a própria pessoa não pode
 * ser a primeira a cair.
 */
export function updateTokens(accessToken: string, refreshToken: string): void {
  const atual = readSession()
  if (!atual) return
  writeJson(KEY, { ...atual, accessToken, refreshToken }, kindAtual())
}

/** Logout explícito, decidido pelo usuário. */
export function clearSession(): void {
  removeKey(KEY, 'local')
  removeKey(KEY, 'session')
}

/** Refresh token inválido/expirado — a sessão acabou sem o usuário pedir. */
export function expireSession(): void {
  clearSession()
  avisarSessaoExpirada?.()
}
