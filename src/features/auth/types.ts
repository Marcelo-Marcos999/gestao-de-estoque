import type { SessionUser } from '@/shared/lib/session'

export type UserRole = 'admin' | 'operador'

/** Mesmo formato que `shared/lib/session.ts` usa — reexportado aqui pras telas não precisarem saber que a sessão mora em `shared/`. */
export type User = SessionUser

export interface Credentials {
  email: string
  password: string
}

/**
 * Erros de autenticação são tratados como valor, não exceção solta:
 * cada caso tem uma mensagem própria na interface.
 */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'account_disabled'
  | 'invalid_token'
  | 'network'

export interface AuthError {
  code: AuthErrorCode
  message: string
}

export type Result<T> = { data: T; error: null } | { data: null; error: AuthError }
