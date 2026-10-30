import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { aoExpirarSessao, clearSession, readSession, writeSession } from '@/shared/lib/session'
import * as authApi from './api'
import type { AuthError, Credentials, User } from './types'

interface AuthContextValue {
  user: User | null
  signIn: (credentials: Credentials, remember: boolean) => Promise<{ error: AuthError | null }>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lida na inicialização do estado, não em efeito: o storage responde na
  // hora, então já sabemos se há sessão no primeiro render. Ler depois
  // custaria um render a mais e uma janela em que a rota seria decidida sem
  // saber quem está logado.
  const [user, setUser] = useState<User | null>(() => readSession()?.user ?? null)

  // O cliente HTTP (`shared/lib/http.ts`) pode decidir, no meio de qualquer
  // chamada, que o refresh token também expirou — isso avisa este contexto
  // pra tirar o usuário da tela sem precisar recarregar a página.
  useEffect(() => {
    aoExpirarSessao(() => setUser(null))
    return () => aoExpirarSessao(null)
  }, [])

  const signIn = useCallback(async (credentials: Credentials, remember: boolean) => {
    const result = await authApi.signIn(credentials)

    if (result.data) {
      // "Manter conectado" decide apenas onde a sessão vive: localStorage
      // sobrevive ao fechar o navegador, sessionStorage não.
      writeSession(result.data, remember)
      setUser(result.data.user)
    }

    return { error: result.error }
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  }
  return context
}
