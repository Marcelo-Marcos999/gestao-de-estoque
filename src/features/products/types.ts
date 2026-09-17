import { EMPTY_RANGE, type NumberRange } from '@/shared/lib/numberRange'

export interface Product {
  id: string
  /** CÓDIGO no ERP. Identifica o produto e é a chave de comparação na importação. */
  sku: string
  /** desc_produtos. */
  description: string
  /** cod_barras (EAN/GTIN). Opcional: nem todo produto tem. */
  barcode: string
  /**
   * Saldo atual na loja. Vem da importação do relatório de estoque ou é
   * digitado. É o mesmo número que a tela de quebra usa para saber se o item
   * ainda está no estoque — não existe saldo paralelo (ver docs/dominio.md).
   */
  stock: number
  /** Quantidade vendida dentro do período configurado. Do segundo relatório. */
  outflow: number
  /** Valor de custo unitário. Vem da tela de Estoque, como saldo e saídas. */
  costPrice: number
  /** Valor de venda unitário. Vem da tela de Estoque, como saldo e saídas. */
  salePrice: number
  /**
   * True para um produto criado pela importação de estoque a partir de um SKU
   * que a base ainda não conhecia (ver docs/dominio.md). Description e barcode
   * nascem vazios; resolver a pendência — completar os dois — é trabalho do
   * administrador aqui no cadastro.
   */
  pendingCadastro: boolean
  createdAt: string
  updatedAt: string
}

/** Campos que o usuário edita; o resto é responsabilidade do sistema. */
export type ProductDraft = Pick<Product, 'sku' | 'description' | 'barcode'>

export type ProductRangeKey = 'stock' | 'outflow' | 'costPrice' | 'salePrice'

/** Rótulo de cada número filtrável, na ordem em que aparece no painel de filtro. */
export const PRODUCT_RANGE_FIELDS: { key: ProductRangeKey; label: string }[] = [
  { key: 'stock', label: 'Saldo' },
  { key: 'outflow', label: 'Saídas' },
  { key: 'costPrice', label: 'Custo' },
  { key: 'salePrice', label: 'Venda' },
]

/** Sem filtro nenhum — para as buscas internas (seletor de produto, código lido) que não passam pelo painel. */
export const EMPTY_PRODUCT_RANGES: Record<ProductRangeKey, NumberRange> = Object.fromEntries(
  PRODUCT_RANGE_FIELDS.map((field) => [field.key, EMPTY_RANGE]),
) as Record<ProductRangeKey, NumberRange>

export interface ProductQuery {
  search: string
  /** Restringe a produtos sem código de barras — útil para completar o cadastro. */
  onlyWithoutBarcode: boolean
  /** Restringe a produtos pendentes de cadastro, criados pela tela de Estoque. */
  onlyPending: boolean
  /** Um intervalo por número da linha, do painel "Filtro" (ver docs/dominio.md). */
  numberRanges: Record<ProductRangeKey, NumberRange>
}
