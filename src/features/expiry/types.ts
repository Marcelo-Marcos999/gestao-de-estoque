import type { IsoDate } from '@/shared/lib/date'
import type { DateRange } from '@/shared/lib/dateRange'
import { EMPTY_RANGE, type NumberRange } from '@/shared/lib/numberRange'
import type { Situation } from './situation'

/**
 * Um lote em acompanhamento: o produto mais a data de validade daquele lote.
 *
 * O mesmo produto pode aparecer mais de uma vez, com validades diferentes —
 * são coisas distintas, uma ainda se vende e a outra não.
 *
 * Saldo, saídas e custo são do estoque da loja do lote (ver docs/dominio.md).
 */
export interface ExpiryItem {
  id: string
  productId: string
  expiryDate: IsoDate | null
  createdAt: string
  /** A loja do lote e os números do estoque DELA: o administrador vê lotes de várias lojas. */
  storeId: string
  storeName: string
  stock: number
  outflow: number
  costPrice: number
}

/** Item com o produto resolvido e a situação já calculada, pronto para a tela. */
export interface ExpiryRow {
  id: string
  productId: string
  storeId: string
  storeName: string
  sku: string
  description: string
  barcode: string
  expiryDate: IsoDate | null
  stock: number
  outflow: number
  /** Custo unitário, herdado do estoque da loja. */
  costPrice: number
  /** Saldo × custo: quanto dinheiro está parado neste produto. Calculado, nunca guardado. */
  totalCost: number
  situation: Situation
  daysToExpiry: number | null
  daysToZero: number | null
}

export type ExpiryRangeKey = 'stock' | 'outflow' | 'costPrice' | 'totalCost'

export const EXPIRY_RANGE_FIELDS: { key: ExpiryRangeKey; label: string }[] = [
  { key: 'stock', label: 'Saldo' },
  { key: 'outflow', label: 'Saídas' },
  { key: 'costPrice', label: 'Custo' },
  { key: 'totalCost', label: 'Total custo' },
]

export const EMPTY_EXPIRY_RANGES: Record<ExpiryRangeKey, NumberRange> = Object.fromEntries(
  EXPIRY_RANGE_FIELDS.map((field) => [field.key, EMPTY_RANGE]),
) as Record<ExpiryRangeKey, NumberRange>

export interface ExpiryQuery {
  search: string
  /** Vazio mostra todas as faixas. */
  situations: Situation[]
  /** Um intervalo por número da linha, do painel "Filtro" (ver docs/dominio.md). */
  numberRanges: Record<ExpiryRangeKey, NumberRange>
  /**
   * Período de validade, do mesmo painel — pergunta diferente da situação:
   * "vence entre 01/10 e 15/10" cruza com qualquer faixa de urgência, os
   * quatro cartões respondem "o quão urgente".
   */
  expiryRange: DateRange
}
