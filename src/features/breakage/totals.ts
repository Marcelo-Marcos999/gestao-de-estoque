import type { LossRecord } from './types'

export interface LossTotals {
  /** Soma de quantidade × custo dos registros na tela: o valor da perda. */
  cost: number
  /** Registros que não entram na soma por não terem custo (produto pendente, ainda sem estoque). */
  withoutCost: number
}

/**
 * O valor da perda do que está na tela, com os filtros aplicados.
 *
 * Conta pura sobre o `totalCost` de cada registro (quantidade DELE × custo da
 * loja dele), então não conta nada duas vezes. Um registro sem custo conhecido
 * não vale zero — fica de fora, e o número de quantos ficaram é devolvido para
 * a tela dizer, em vez de um total que parece completo e não é.
 */
export function sumLossTotals(records: LossRecord[]): LossTotals {
  let cost = 0
  let withoutCost = 0

  for (const record of records) {
    if (record.totalCost === null) withoutCost++
    else cost += record.totalCost
  }

  return { cost, withoutCost }
}
