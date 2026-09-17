/**
 * Total de custo e total de venda de uma linha de estoque: saldo × valor
 * unitário. Nunca guardado — é conta pura sobre o que já existe, e guardar o
 * resultado deixaria a tela mentindo assim que alguém corrigisse o saldo ou o
 * valor unitário sem lembrar de recalcular (mesma razão pela qual a situação
 * de validade também é sempre calculada, nunca digitada).
 */
import type { StockRow } from './types'

export function rowCostTotal(row: StockRow): number {
  return row.stock * row.costPrice
}

export function rowSaleTotal(row: StockRow): number {
  return row.stock * row.salePrice
}

export interface StockTotals {
  cost: number
  sale: number
}

/** Soma dos totais de uma lista de linhas — o que está na tela, com os filtros aplicados. */
export function sumStockTotals(rows: StockRow[]): StockTotals {
  return rows.reduce(
    (acc, row) => ({
      cost: acc.cost + rowCostTotal(row),
      sale: acc.sale + rowSaleTotal(row),
    }),
    { cost: 0, sale: 0 },
  )
}
