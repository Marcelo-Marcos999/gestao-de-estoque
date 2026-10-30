/**
 * Listas de motivo e origem.
 *
 * São editáveis por qualquer usuário, mas a lista é **uma só, da conta**. Se
 * cada pessoa mantivesse a própria, "danificado", "danificada" e "avaria"
 * virariam três motivos e a soma por motivo deixaria de fechar — o mesmo
 * problema que manter o cadastro de produtos sob o administrador evita.
 *
 * Moram no back-end (`/motivos` e `/origens`): o registro de quebra aponta
 * para o id da etiqueta, e esse id precisa existir no banco.
 */
import { ApiError, apiFetch } from '@/shared/lib/http'
import type { Tag } from './types'

export type TagKind = 'reason' | 'origin'

/** Quantos registros usam cada etiqueta, por id. */
export type TagUsage = Record<string, number>

export interface TagLists {
  reasons: Tag[]
  origins: Tag[]
  usage: { reasons: TagUsage; origins: TagUsage }
}

const ROTA: Record<TagKind, string> = { reason: '/motivos', origin: '/origens' }

interface EtiquetaApi {
  id: string
  label: string
  embutido: boolean
  uso?: number
}

function paraTag(e: EtiquetaApi): Tag {
  return { id: e.id, label: e.label, builtIn: e.embutido }
}

function usoPorId(lista: EtiquetaApi[]): TagUsage {
  return Object.fromEntries(lista.map((e) => [e.id, e.uso ?? 0]))
}

/** As duas listas de uma vez, com a contagem de uso de cada etiqueta. Sempre fresca: o uso muda a cada registro. */
export async function loadTags(): Promise<TagLists> {
  const [motivos, origens] = await Promise.all([
    apiFetch<EtiquetaApi[]>(ROTA.reason),
    apiFetch<EtiquetaApi[]>(ROTA.origin),
  ])

  return {
    reasons: motivos.map(paraTag),
    origins: origens.map(paraTag),
    usage: { reasons: usoPorId(motivos), origins: usoPorId(origens) },
  }
}

export async function createTag(kind: TagKind, label: string): Promise<Tag> {
  return paraTag(await apiFetch<EtiquetaApi>(ROTA[kind], { method: 'POST', body: { label } }))
}

export async function renameTag(kind: TagKind, id: string, label: string): Promise<void> {
  await apiFetch(`${ROTA[kind]}/${id}`, { method: 'PATCH', body: { label } })
}

export async function deleteTag(kind: TagKind, id: string): Promise<void> {
  await apiFetch(`${ROTA[kind]}/${id}`, { method: 'DELETE' })
}

/** Etiqueta recusada por já existir (nome repetido) ou por estar em uso. */
export function isTagConflict(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 409
}

export function labelOf(tags: Tag[], id: string): string {
  return tags.find((t) => t.id === id)?.label ?? ''
}
