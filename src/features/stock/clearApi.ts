import { apiFetch } from '@/shared/lib/http'
import { invalidateStore } from '@/features/products'

export interface StockCounts {
  /** Posições de estoque (produto × loja) que seriam apagadas. */
  rows: number
  /** Lotes de validade que saem junto, por dependerem dessas posições. */
  lots: number
}

/** Quanto existe para apagar: a tela mostra isto antes de pedir a confirmação. */
export async function getStockCounts(): Promise<StockCounts> {
  const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>('/estoque/contagem')
  return { rows: linhas, lots: lotes }
}

/**
 * Apaga todo o estoque da loja, para quem vai reimportar a base do zero. Os
 * produtos continuam no cadastro; os lotes de validade saem junto (ver
 * `DELETE /estoque` no back-end).
 */
export async function deleteAllStock(): Promise<StockCounts> {
  try {
    const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>('/estoque', {
      method: 'DELETE',
    })
    return { rows: linhas, lots: lotes }
  } finally {
    // O cadastro mostra saldo e custo vindos do estoque: o cache velho
    // continuaria exibindo números que acabaram de ser apagados.
    invalidateStore()
  }
}

/** O que o servidor aceita por chamada em `/estoque/linhas`; 2000 mantém o corpo bem abaixo do limite de 1 MB. */
const BATCH = 2000

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += BATCH) out.push(items.slice(i, i + BATCH))
  return out
}

/** O que sairia ao apagar só estes produtos do estoque (soma dos lotes de envio). */
export async function getSelectionCounts(productIds: string[]): Promise<StockCounts> {
  const total: StockCounts = { rows: 0, lots: 0 }
  for (const ids of chunks(productIds)) {
    const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>('/estoque/linhas/contagem', {
      method: 'POST',
      body: { produtoIds: ids },
    })
    total.rows += linhas
    total.lots += lotes
  }
  return total
}

/** Apaga o estoque só dos produtos escolhidos. Os lotes de validade deles saem junto. */
export async function deleteStockRows(productIds: string[]): Promise<StockCounts> {
  const total: StockCounts = { rows: 0, lots: 0 }
  try {
    for (const ids of chunks(productIds)) {
      const { linhas, lotes } = await apiFetch<{ linhas: number; lotes: number }>('/estoque/linhas', {
        method: 'DELETE',
        body: { produtoIds: ids },
      })
      total.rows += linhas
      total.lots += lotes
    }
  } finally {
    invalidateStore()
  }
  return total
}
