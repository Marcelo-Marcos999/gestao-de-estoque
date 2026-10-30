import type { UserRole } from '@/features/auth'

/** A empresa (a conta) e o que o plano dela permite. */
export interface Company {
  name: string
  plan: string
  /** `null` = sem limite. */
  userLimit: number | null
  storageLimitMb: number | null
  activeUsers: number
}

/**
 * Um login. No sistema, o login **é** a loja: não existe usuário dentro de
 * loja, e por isso a tela se chama "Lojas e logins" (ver docs/modelo-de-dados.md).
 */
export interface StoreLogin {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
}

export interface NewLoginDraft {
  name: string
  email: string
  role: UserRole
}

/** Resposta de criar e de redefinir: a senha provisória só existe aqui, uma vez. */
export interface LoginWithPassword {
  login: StoreLogin
  temporaryPassword: string
}
