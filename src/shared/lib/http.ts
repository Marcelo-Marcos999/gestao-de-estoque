/**
 * Cliente HTTP único pra toda chamada ao back-end.
 *
 * Centralizado aqui pra duas coisas não precisarem ser repetidas em cada
 * `api.ts`: anexar o token de acesso, e renovar esse token sozinho quando
 * ele expira no meio de uma chamada (ver `shared/lib/session.ts`).
 */
import { expireSession, readSession, updateAccessToken } from './session'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3100').replace(/\/$/, '')

interface CorpoErro {
  erro?: string
  codigo?: string
}

/**
 * `codigo` carrega valores de máquina (ex.: "sku_duplicado") que a tela usa
 * pra decidir o que mostrar; `message` é só pra log — a mensagem que o
 * usuário vê continua sendo escrita pela tela, não pelo back-end.
 */
export class ApiError extends Error {
  readonly status: number
  readonly codigo?: string

  constructor(status: number, message: string, codigo?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
  }
}

async function chamarRefresh(refreshToken: string): Promise<string | null> {
  const resposta = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  if (!resposta.ok) return null

  const corpo = (await resposta.json()) as { accessToken: string }
  return corpo.accessToken
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Um arquivo no corpo, cru e com o tipo dele (anexos): em vez de JSON. */
  file?: Blob
}

async function fazerRequisicao(path: string, token: string | null, options: ApiRequestOptions) {
  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': options.file?.type || 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.file ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  })
}

async function lerResultado<T>(resposta: Response): Promise<T> {
  if (!resposta.ok) {
    const corpo: CorpoErro = await resposta.json().catch(() => ({}))
    throw new ApiError(resposta.status, corpo.erro ?? 'Erro inesperado no servidor.', corpo.codigo)
  }

  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}

/**
 * Chama uma rota do back-end já autenticada com o token da sessão.
 *
 * Em 401, tenta renovar o access token exatamente uma vez (o refresh token
 * dura dias; o de acesso, minutos — expirar no meio de um uso normal é
 * esperado) e repete a chamada original. Se o refresh também falhar, a
 * sessão é encerrada e o 401 original sobe pra tela.
 */
async function chamarComSessao(path: string, options: ApiRequestOptions): Promise<Response> {
  const sessao = readSession()

  let resposta = await fazerRequisicao(path, sessao?.accessToken ?? null, options)

  if (resposta.status === 401 && sessao) {
    const novoToken = await chamarRefresh(sessao.refreshToken)
    if (novoToken) {
      updateAccessToken(novoToken)
      resposta = await fazerRequisicao(path, novoToken, options)
    } else {
      expireSession()
    }
  }

  return resposta
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return lerResultado<T>(await chamarComSessao(path, options))
}

/**
 * Baixa um arquivo (anexo). Não dá para usar `<img src>` direto na URL: o
 * navegador não manda o token nessas requisições, e o arquivo só vale para
 * quem tem acesso ao registro — por isso o download passa por aqui.
 */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const resposta = await chamarComSessao(path, {})
  if (!resposta.ok) await lerResultado<never>(resposta)
  return resposta.blob()
}

/** Sem sessão ainda — login e o refresh em si são as únicas chamadas que passam por aqui. */
export async function apiFetchPublico<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const resposta = await fazerRequisicao(path, null, options)
  return lerResultado<T>(resposta)
}

/** Com um token específico na mão, sem depender da sessão gravada — usado só logo após o login, pra buscar o perfil antes da sessão existir de verdade. */
export async function apiFetchComToken<T>(
  path: string,
  token: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const resposta = await fazerRequisicao(path, token, options)
  return lerResultado<T>(resposta)
}
