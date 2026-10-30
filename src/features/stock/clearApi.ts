import { apiFetch } from '@/shared/lib/http'
import { invalidateStore } from '@/features/products'

export interface StockCounts {
  /** Posições de estoque (produto × loja) que seriam apagadas. */
  rows: number
  /** Lotes de validade que saem junto, por dependerem dessas posições. */
  lots: number
}

const storeQuery = (storeId?: string) => (storeId ? `?loja=${storeId}` : '')

/**
 * Quanto existe para apagar: a tela mostra isto antes de pedir a confirmação.
 * De UMA loja — a do login, ou a escolhida (administrador).
 */
export async function getStockCounts(storeId?: string): Promise<StockCounts> {
  const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>(
    `/estoque/contagem${storeQuery(storeId)}`,
  )
  return { rows: linhas, lots: lotes }
}

/**
 * Apaga todo o estoque da loja, para quem vai reimportar a base do zero. Os
 * produtos continuam no cadastro; os lotes de validade saem junto (ver
 * `DELETE /estoque` no back-end).
 */
export async function deleteAllStock(storeId?: string): Promise<StockCounts> {
  try {
    const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>(
      `/estoque${storeQuery(storeId)}`,
      { method: 'DELETE' },
    )
    return { rows: linhas, lots: lotes }
  } finally {
    // O cadastro mostra saldo e custo vindos do estoque: o cache velho
    // continuaria exibindo números que acabaram de ser apagados.
    invalidateStore()
  }
}

/** O que o servidor aceita por chamada em `/estoque/linhas`; 2000 mantém o corpo bem abaixo do limite de 1 MB. */
const BATCH = 2000

/** Uma posição a apagar: produto numa loja. */
export interface StockTarget {
  storeId: string
  productId: string
}

/**
 * Agrupa por loja e fatia em lotes: o servidor apaga de UMA loja por chamada, e
 * o administrador pode ter marcado linhas de várias.
 */
function batches(targets: StockTarget[]): Array<{ storeId: string; productIds: string[] }> {
  const byStore = new Map<string, string[]>()
  for (const t of targets) byStore.set(t.storeId, [...(byStore.get(t.storeId) ?? []), t.productId])

  const out: Array<{ storeId: string; productIds: string[] }> = []
  for (const [storeId, ids] of byStore) {
    for (let i = 0; i < ids.length; i += BATCH) out.push({ storeId, productIds: ids.slice(i, i + BATCH) })
  }
  return out
}

/** O que sairia ao apagar só estas posições (soma dos lotes de envio). */
export async function getSelectionCounts(targets: StockTarget[]): Promise<StockCounts> {
  const total: StockCounts = { rows: 0, lots: 0 }
  for (const batch of batches(targets)) {
    const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>(
      `/estoque/linhas/contagem${storeQuery(batch.storeId)}`,
      { method: 'POST', body: { produtoIds: batch.productIds } },
    )
    total.rows += linhas
    total.lots += lotes
  }
  return total
}

/** Apaga o estoque só das posições escolhidas. Os lotes de validade delas saem junto. */
export async function deleteStockRows(targets: StockTarget[]): Promise<StockCounts> {
  const total: StockCounts = { rows: 0, lots: 0 }
  try {
    for (const batch of batches(targets)) {
      const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>(
        `/estoque/linhas${storeQuery(batch.storeId)}`,
        { method: 'DELETE', body: { produtoIds: batch.productIds } },
      )
      total.rows += linhas
      total.lots += lotes
    }
  } finally {
    invalidateStore()
  }
  return total
}
