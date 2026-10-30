import type { ExpiryRow } from './types'

export interface ExpiryTotals {
  /** Custo do estoque dos produtos mostrados (cada produto uma vez só). */
  cost: number
  /** Custo do estoque dos produtos com algum lote vencido ou que vence antes de vender. */
  atRisk: number
  products: number
  productsAtRisk: number
}

/**
 * Quanto dinheiro está parado — e quanto está em risco — nos lotes mostrados.
 *
 * Um lote só guarda a data: saldo e custo são do PRODUTO na loja (ver
 * docs/dominio.md). Somar `totalCost` linha a linha contaria o mesmo estoque
 * uma vez por lote, então a soma é por produto e loja distintos.
 *
 * "Em risco" é o estoque inteiro do produto que tem algum lote vencido ou que
 * vence antes de vender. Como o lote não tem quantidade própria, é um teto: o
 * que se perde de fato é no máximo isso.
 */
export function sumExpiryTotals(rows: ExpiryRow[]): ExpiryTotals {
  const costByProduct = new Map<string, number>()
  const atRisk = new Set<string>()

  for (const row of rows) {
    const key = `${row.storeId}:${row.productId}`
    costByProduct.set(key, row.totalCost)
    if (row.situation === 'venceu' || row.situation === 'vence-antes') atRisk.add(key)
  }

  let cost = 0
  let atRiskCost = 0
  for (const [key, value] of costByProduct) {
    cost += value
    if (atRisk.has(key)) atRiskCost += value
  }

  return { cost, atRisk: atRiskCost, products: costByProduct.size, productsAtRisk: atRisk.size }
}
