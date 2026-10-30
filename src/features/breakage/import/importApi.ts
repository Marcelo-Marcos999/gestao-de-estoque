import { apiFetch } from '@/shared/lib/http'
import { normalizeHeader } from '@/shared/import/fields'
import { createTag, loadTags, type TagKind } from '../tags'
import type { BreakageImportPlan, TagRef } from './plan'

export interface BreakageImportResult {
  created: number
  pending: number
  newReasons: number
  newOrigins: number
}

/** O que `POST /quebras` aceita por chamada. */
const BATCH = 500

/**
 * Cria na lista os nomes que a planilha trouxe e a lista não tem, e devolve o
 * id de cada um pelo nome normalizado. Se outro usuário criou o mesmo nome no
 * meio da importação, o servidor recusa (409) e o nome é lido da lista.
 */
async function ensureTags(kind: TagKind, labels: string[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  for (const label of labels) {
    try {
      ids.set(normalizeHeader(label), (await createTag(kind, label)).id)
    } catch {
      const lists = await loadTags()
      const found = (kind === 'reason' ? lists.reasons : lists.origins).find(
        (t) => normalizeHeader(t.label) === normalizeHeader(label),
      )
      if (!found) throw new Error(`Não foi possível criar "${label}".`)
      ids.set(normalizeHeader(label), found.id)
    }
  }
  return ids
}

/**
 * Grava os registros do plano.
 *
 * Importar NÃO cria lotes na tela de Validades, diferente de registrar uma
 * quebra à mão: ali a quebra de um lote diz que ele existe na loja; aqui são
 * perdas já ocorridas de uma base antiga, e lotes vencidos antigos encheriam a
 * lista de Validades de coisa que ninguém mais acompanha.
 */
export async function importLossRecords(
  plan: BreakageImportPlan,
  onProgress: (done: number, total: number) => void,
): Promise<BreakageImportResult> {
  const entering = plan.rows.filter((r) => r.status === 'novo' || r.status === 'pendente')

  const reasonIds = await ensureTags('reason', plan.newReasons)
  const originIds = await ensureTags('origin', plan.newOrigins)
  const idOf = (ref: TagRef, created: Map<string, string>) =>
    ref.id ?? created.get(normalizeHeader(ref.newLabel ?? ''))

  const items = entering.map((row) => {
    const d = row.data!
    return {
      produtoId: d.productId || null,
      sku: d.sku,
      descricao: d.description,
      codigoBarras: d.barcode,
      pendente: d.pendingProduct,
      dataValidade: d.expiryDate,
      quantidade: d.quantity,
      observacao: d.note,
      motivoId: idOf(d.reasonRef, reasonIds),
      origemId: idOf(d.originRef, originIds),
    }
  })

  for (let i = 0; i < items.length; i += BATCH) {
    await apiFetch('/quebras', { method: 'POST', body: { itens: items.slice(i, i + BATCH) } })
    onProgress(Math.min(i + BATCH, items.length), items.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return {
    created: items.length,
    pending: entering.filter((r) => r.status === 'pendente').length,
    newReasons: plan.newReasons.length,
    newOrigins: plan.newOrigins.length,
  }
}
