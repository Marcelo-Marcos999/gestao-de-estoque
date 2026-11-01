/**
 * Camada de acesso a dados da conta: troca de senha, empresa e logins.
 *
 * Fala com o back-end (`/conta` e `/lojas`). As rotas de `/lojas` são só do
 * administrador, e o servidor é quem garante isso: a tela esconde, o servidor
 * recusa (ver CLAUDE.md, "Perfis de acesso").
 */
import { apiFetch } from '@/shared/lib/http'
import { updateTokens } from '@/shared/lib/session'
import type { Company, LoginWithPassword, NewLoginDraft, StoreLogin } from './types'

interface LojaApi {
  id: string
  nome: string
  email: string
  role: 'admin' | 'operador'
  ativo: boolean
  criado_em: string
}

function paraStoreLogin(l: LojaApi): StoreLogin {
  return {
    id: l.id,
    name: l.nome,
    email: l.email,
    role: l.role,
    active: l.ativo,
    createdAt: l.criado_em,
  }
}

/**
 * Troca a senha de quem está logado. O servidor devolve tokens novos (trocar
 * a senha encerra as outras sessões) e eles substituem os guardados aqui —
 * senão a própria pessoa seria a primeira a ser deslogada.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { accessToken, refreshToken } = await apiFetch<{ accessToken: string; refreshToken: string }>(
    '/conta/alterar-senha',
    { method: 'POST', body: { senhaAtual: currentPassword, senhaNova: newPassword } },
  )
  updateTokens(accessToken, refreshToken)
}

export async function getCompany(): Promise<Company> {
  const c = await apiFetch<{
    nome: string
    plano: string
    limiteUsuarios: number | null
    limiteArmazenamentoMb: number | null
    limiteRegistros: number | null
    usuariosAtivos: number
    usoRegistros: number
    usoArquivosBytes: number
  }>('/conta')

  return {
    name: c.nome,
    plan: c.plano,
    userLimit: c.limiteUsuarios,
    storageLimitMb: c.limiteArmazenamentoMb,
    recordLimit: c.limiteRegistros,
    activeUsers: c.usuariosAtivos,
    recordsUsed: c.usoRegistros,
    filesUsedBytes: c.usoArquivosBytes,
  }
}

export async function renameCompany(name: string): Promise<void> {
  await apiFetch('/conta', { method: 'PATCH', body: { nome: name } })
}

export async function listLogins(): Promise<StoreLogin[]> {
  return (await apiFetch<LojaApi[]>('/lojas')).map(paraStoreLogin)
}

export async function createLogin(draft: NewLoginDraft): Promise<LoginWithPassword> {
  const r = await apiFetch<{ loja: LojaApi; senhaTemporaria: string }>('/lojas', {
    method: 'POST',
    body: { nome: draft.name, email: draft.email, role: draft.role },
  })
  return { login: paraStoreLogin(r.loja), temporaryPassword: r.senhaTemporaria }
}

export async function setLoginActive(id: string, active: boolean): Promise<void> {
  await apiFetch(`/lojas/${id}`, { method: 'PATCH', body: { ativo: active } })
}

/** Gera outra senha provisória; a anterior deixa de valer e as sessões do login caem. */
export async function resetLoginPassword(id: string): Promise<string> {
  const { senhaTemporaria } = await apiFetch<{ senhaTemporaria: string }>(
    `/lojas/${id}/redefinir-senha`,
    { method: 'POST' },
  )
  return senhaTemporaria
}
