/**
 * Camada de acesso a dados do painel da plataforma (`/plataforma/*` no servidor).
 *
 * Não usa `apiFetch`: aquele cliente anexa o token do CLIENTE e renova a sessão dele
 * em um 401. Aqui o token é outro (o do dono do sistema), vive só na memória da
 * página, e um 401 significa "entre de novo" — sem refresh.
 */
import { apiFetchComToken, apiFetchPublico } from '@/shared/lib/http'
import type { CompanyLimits, PlatformCompany } from './types'

interface ContaApi {
  id: string
  nome: string
  criadoEm: string
  emailAdmin: string | null
  plano: string
  limiteUsuarios: number | null
  limiteArmazenamentoMb: number | null
  limiteRegistros: number | null
  usuariosAtivos: number
  usuariosTotal: number
  registros: number
  arquivosBytes: number
}

export async function signInPlatform(email: string, password: string): Promise<{ token: string; name: string }> {
  const r = await apiFetchPublico<{ accessToken: string; nome: string }>('/plataforma/login', {
    method: 'POST',
    body: { email, senha: password },
  })
  return { token: r.accessToken, name: r.nome }
}

export async function listCompanies(token: string): Promise<PlatformCompany[]> {
  const contas = await apiFetchComToken<ContaApi[]>('/plataforma/contas', token)
  return contas.map((c) => ({
    id: c.id,
    name: c.nome,
    createdAt: c.criadoEm,
    adminEmail: c.emailAdmin,
    plan: c.plano,
    userLimit: c.limiteUsuarios,
    storageLimitMb: c.limiteArmazenamentoMb,
    recordLimit: c.limiteRegistros,
    activeUsers: c.usuariosAtivos,
    totalUsers: c.usuariosTotal,
    recordsUsed: c.registros,
    filesUsedBytes: c.arquivosBytes,
  }))
}

export async function setCompanyLimits(token: string, id: string, limits: CompanyLimits): Promise<void> {
  await apiFetchComToken(`/plataforma/contas/${id}/limites`, token, {
    method: 'PATCH',
    body: {
      limiteUsuarios: limits.userLimit,
      limiteArmazenamentoMb: limits.storageLimitMb,
      limiteRegistros: limits.recordLimit,
    },
  })
}

export async function deleteCompany(token: string, id: string, confirmation: string): Promise<{ filesDeleted: number }> {
  const r = await apiFetchComToken<{ arquivosApagados: number }>(`/plataforma/contas/${id}`, token, {
    method: 'DELETE',
    body: { confirmacao: confirmation },
  })
  return { filesDeleted: r.arquivosApagados }
}
