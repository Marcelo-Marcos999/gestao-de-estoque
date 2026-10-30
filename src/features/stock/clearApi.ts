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
