/**
 * Camada de acesso a dados da autenticação.
 *
 * Fala com o back-end de verdade: POST /auth/login devolve os dois tokens,
 * GET /auth/me devolve nome/e-mail/role de quem acabou de logar (ver
 * backend/src/rotas/auth.ts — por que o perfil não vem dentro do próprio
 * token).
 */
import { ApiError, apiFetchComToken, apiFetchPublico } from '@/shared/lib/http'
import type { Session } from '@/shared/lib/session'
import type { AuthError, Credentials, Result } from './types'

function fail(code: AuthError['code'], message: string): { data: null; error: AuthError } {
  return { data: null, error: { code, message } }
}

interface RespostaLogin {
  accessToken: string
  refreshToken: string
}

export async function signIn({ email, password }: Credentials): Promise<Result<Session>> {
  try {
    const { accessToken, refreshToken } = await apiFetchPublico<RespostaLogin>('/auth/login', {
      method: 'POST',
      body: { email, senha: password },
    })

    // O back-end responde a mesma mensagem genérica pra e-mail inexistente,
    // senha errada e conta desativada (ver rotas/auth.ts) — por isso aqui
    // não precisa de um caso pra "account_disabled" separado, diferente da
    // versão em memória que tinha essa distinção.
    const user = await apiFetchComToken<Session['user']>('/auth/me', accessToken)

    return { data: { user, accessToken, refreshToken }, error: null }
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 401) {
      return fail('invalid_credentials', 'E-mail ou senha incorretos.')
    }
    return fail('network', 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.')
  }
}

/**
 * PROVISÓRIO: o back-end ainda não tem envio de e-mail nem rota de
 * recuperação de senha — isso depende de um provedor de e-mail, que é uma
 * peça de infraestrutura própria, ainda não escolhida. Enquanto isso não
 * existe, a tela continua respondendo sucesso sem fazer nada de verdade.
 */
export async function requestPasswordReset(email: string): Promise<Result<{ sent: true }>> {
  void email
  return { data: { sent: true }, error: null }
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<Result<{ reset: true }>> {
  void newPassword

  if (!token) {
    return fail(
      'invalid_token',
      'Este link de redefinição é inválido ou já expirou. Peça um novo.',
    )
  }

  return { data: { reset: true }, error: null }
}
