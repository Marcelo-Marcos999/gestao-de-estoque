import { EMPTY_RANGE, type NumberRange } from '@/shared/lib/numberRange'

/**
 * Uma linha da tela de Estoque: o produto, visto pelos números que vêm da
 * importação dos relatórios.
 *
 * Não é uma entidade própria — é o mesmo `Product` do cadastro, só que
 * observado pelos campos que esta tela edita (saldo, saídas, custo e venda)
 * em vez dos campos de identidade (SKU, descrição, código de barras), que são
 * do administrador (ver CLAUDE.md, "Perfis de acesso").
 */
export interface StockRow {
  productId: string
  sku: string
  description: string
  barcode: string
  stock: number
  outflow: number
  costPrice: number
  salePrice: number
  /** Ainda sem descrição nem código de barras: a importação criou o produto. */
  pendingCadastro: boolean
}

/** Total custo e total venda entram junto dos quatro números da linha: são a mesma pergunta ("quanto vale isto"), só que calculada (ver `totals.ts`). */
export type StockRangeKey =
  | 'stock'
  | 'outflow'
  | 'costPrice'
  | 'salePrice'
  | 'totalCost'
  | 'totalSale'

export const STOCK_RANGE_FIELDS: { key: StockRangeKey; label: string }[] = [
  { key: 'stock', label: 'Saldo' },
  { key: 'outflow', label: 'Saídas' },
  { key: 'costPrice', label: 'Custo' },
  { key: 'salePrice', label: 'Venda' },
  { key: 'totalCost', label: 'Total custo' },
  { key: 'totalSale', label: 'Total venda' },
]

export const EMPTY_STOCK_RANGES: Record<StockRangeKey, NumberRange> = Object.fromEntries(
  STOCK_RANGE_FIELDS.map((field) => [field.key, EMPTY_RANGE]),
) as Record<StockRangeKey, NumberRange>

export interface StockQuery {
  search: string
  /** Restringe a produtos pendentes de cadastro. */
  onlyPending: boolean
  /** Um intervalo por número da linha, do painel "Filtro" (ver docs/dominio.md). */
  numberRanges: Record<StockRangeKey, NumberRange>
}
