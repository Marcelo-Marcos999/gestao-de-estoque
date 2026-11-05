/**
 * As contas da auditoria. Nunca guardadas: a diferença depende do saldo, que
 * muda quando alguém corrige o estoque, e um número gravado ficaria mentindo
 * (mesma razão do total de custo do Estoque e da situação das Validades).
 */
import { lineTotal } from '@/shared/lib/money'
import type { AuditRow } from './types'

/** Estoque menos contagem. Positivo: o sistema tem mais do que se encontrou. */
export function rowDifference(row: AuditRow): number {
  return row.stock - row.counted
}

/** A diferença em reais: (estoque − contagem) × custo do estoque. */
export function rowDifferenceValue(row: AuditRow): number {
  return lineTotal(rowDifference(row), row.costPrice)
}

export type DifferenceKind = 'falta' | 'sobra' | 'confere'

/**
 * Em palavras, porque o sinal sozinho confunde: "−2" pode ser lido como "faltam
 * 2" ou como "2 a menos no sistema". "Falta" é o produto que o sistema diz ter e
 * ninguém achou; "sobra" é o que se achou além do que o sistema conhece.
 */
export function differenceKind(row: AuditRow): DifferenceKind {
  const difference = rowDifference(row)
  if (difference > 0) return 'falta'
  if (difference < 0) return 'sobra'
  return 'confere'
}

export interface AuditTotals {
  /** Valor do que falta (soma só das diferenças positivas). */
  shortage: number
  /** Valor do que sobra, em módulo. */
  surplus: number
  /** Falta menos sobra: o resultado líquido da conferência. */
  net: number
}

/**
 * Falta e sobra ficam separadas porque se anulariam no total: R$ 500 que faltam
 * num produto e R$ 500 que sobram em outro dariam "zero", e a loja teria dois
 * problemas, não nenhum.
 */
export function sumAuditTotals(rows: AuditRow[]): AuditTotals {
  let shortage = 0
  let surplus = 0
  for (const row of rows) {
    const value = rowDifferenceValue(row)
    if (value > 0) shortage += value
    else surplus -= value
  }
  return { shortage, surplus, net: shortage - surplus }
}

export const rowCostTotal = (row: AuditRow): number => lineTotal(row.stock, row.costPrice)
export const rowSaleTotal = (row: AuditRow): number => lineTotal(row.stock, row.salePrice)
