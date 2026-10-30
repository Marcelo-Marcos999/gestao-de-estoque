/**
 * Camada de acesso a dados da autenticação.
 *
 * Fala com o back-end de verdade (backend/src/rotas/auth.ts, cadastro.ts):
 * login e refresh devolvem os dois tokens; /auth/me devolve nome/e-mail/role de
 * quem acabou de logar (por que o perfil não vem dentro do próprio token está
 * explicado lá). Cadastro, confirmação de e-mail e recuperação de senha passam
 * por e-mail com um link de uso único.
 */
import { ApiError, apiFetchComToken, apiFetchPublico } from '@/shared/lib/http'
import type { Session } from '@/shared/lib/session'
import type { AuthError, Credentials, Result } from './types'

function fail(code: AuthError['code'], message: string): { data: null; error: AuthError } {
  return { data: null, error: { code, message } }
}

/**
 * Traduz o erro do servidor pro que a tela precisa. A mensagem do servidor é
 * mostrada como veio quando ela é pra pessoa ler (validação, link inválido);
 * nos demais casos a mensagem é nossa.
 */
function toAuthError(erro: unknown): AuthError {
  if (erro instanceof ApiError) {
    if (erro.codigo === 'email_nao_confirmado') {
      return { code: 'email_not_confirmed', message: erro.message }
    }
    if (erro.codigo === 'email_indisponivel') {
      return {
        code: 'email_unavailable',
        message:
          'O envio de e-mail ainda não está ativo neste sistema. Tente mais tarde ou fale com o administrador.',
      }
    }
    if (erro.codigo === 'token_invalido') {
      return { code: 'invalid_token', message: erro.message }
    }
    if (erro.status === 429) {
      return {
        code: 'rate_limited',
        message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
      }
    }
    if (erro.status === 400) {
      return { code: 'validation', message: erro.message }
    }
  }

  return {
    code: 'network',
    message: 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.',
  }
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
    // não há um caso separado pra "account_disabled".
    const user = await apiFetchComToken<Session['user']>('/auth/me', accessToken)

    return { data: { user, accessToken, refreshToken }, error: null }
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 401) {
      return fail('invalid_credentials', 'E-mail ou senha incorretos.')
    }
    return { data: null, error: toAuthError(erro) }
  }
}

interface NovaConta {
  companyName: string
  email: string
  password: string
}

/**
 * Cria a conta. A resposta é a mesma exista o e-mail ou não, e a conta só vale
 * depois de confirmar o e-mail: a tela nunca diz "e-mail já cadastrado".
 */
export async function signUp({ companyName, email, password }: NovaConta): Promise<Result<{ sent: true }>> {
  try {
    await apiFetchPublico('/auth/cadastro', {
      method: 'POST',
      body: { nomeEmpresa: companyName, email, senha: password },
    })
    return { data: { sent: true }, error: null }
  } catch (erro) {
    return { data: null, error: toAuthError(erro) }
  }
}

export async function confirmEmail(token: string): Promise<Result<{ confirmed: true }>> {
  try {
    await apiFetchPublico('/auth/confirmar-email', { method: 'POST', body: { token } })
    return { data: { confirmed: true }, error: null }
  } catch (erro) {
    return { data: null, error: toAuthError(erro) }
  }
}

/** Pra quem perdeu o link de confirmação ou deixou vencer (vale 24 horas). */
export async function resendConfirmation(email: string): Promise<Result<{ sent: true }>> {
  try {
    await apiFetchPublico('/auth/reenviar-confirmacao', { method: 'POST', body: { email } })
    return { data: { sent: true }, error: null }
  } catch (erro) {
    return { data: null, error: toAuthError(erro) }
  }
}

/**
 * Pede o link de recuperação. Responde sucesso mesmo quando o e-mail não
 * existe — a tela mostra sempre a mesma confirmação, pra não funcionar como
 * uma lista de e-mails válidos. Só erros que valem pra qualquer e-mail (e-mail
 * desligado no servidor, limite de tentativas, sem rede) chegam à tela.
 */
export async function requestPasswordReset(email: string): Promise<Result<{ sent: true }>> {
  try {
    await apiFetchPublico('/auth/esqueci-senha', { method: 'POST', body: { email } })
    return { data: { sent: true }, error: null }
  } catch (erro) {
    return { data: null, error: toAuthError(erro) }
  }
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<Result<{ reset: true }>> {
  // Sem token no endereço não há o que enviar; o servidor diria o mesmo.
  if (!token) {
    return fail(
      'invalid_token',
      'Este link de redefinição é inválido ou já expirou. Peça um novo.',
    )
  }

  try {
    await apiFetchPublico('/auth/redefinir-senha', {
      method: 'POST',
      body: { token, senha: newPassword },
    })
    return { data: { reset: true }, error: null }
  } catch (erro) {
    return { data: null, error: toAuthError(erro) }
  }
}
