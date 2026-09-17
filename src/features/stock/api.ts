/**
 * Acesso a dados da tela de Estoque.
 *
 * Não guarda nada próprio: a fonte é o cadastro de produtos (`@/features/products`),
 * que já isola saldo, saídas, custo e venda do que é identidade (SKU,
 * descrição, código de barras). Esta tela só olha esses quatro números de um
 * ângulo diferente e sabe importá-los em massa.
 */
import {
  bulkUpsertStock,
  getAllProducts,
  updateProductStock,
  type Product,
  type StockImportRow,
  type StockValues,
} from '@/features/products'
import { matchesRange } from '@/shared/lib/numberRange'
import { rowCostTotal, rowSaleTotal } from './totals'
import type { StockQuery, StockRow } from './types'

const LATENCY_MS = 180

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toRow(product: Product): StockRow {
  return {
    productId: product.id,
    sku: product.sku,
    description: product.description,
    barcode: product.barcode,
    stock: product.stock,
    outflow: product.outflow,
    costPrice: product.costPrice,
    salePrice: product.salePrice,
    pendingCadastro: product.pendingCadastro,
  }
}

function matches(row: StockRow, query: StockQuery): boolean {
  if (query.onlyPending && !row.pendingCadastro) return false
  if (!matchesRange(row.stock, query.numberRanges.stock)) return false
  if (!matchesRange(row.outflow, query.numberRanges.outflow)) return false
  if (!matchesRange(row.costPrice, query.numberRanges.costPrice)) return false
  if (!matchesRange(row.salePrice, query.numberRanges.salePrice)) return false
  if (!matchesRange(rowCostTotal(row), query.numberRanges.totalCost)) return false
  if (!matchesRange(rowSaleTotal(row), query.numberRanges.totalSale)) return false

  const term = query.search.trim().toLowerCase()
  if (!term) return true

  return (
    row.sku.toLowerCase().includes(term) ||
    row.description.toLowerCase().includes(term) ||
    row.barcode.includes(term)
  )
}

export interface StockPage {
  items: StockRow[]
  total: number
}

export async function listStockRows(query: StockQuery): Promise<StockPage> {
  await delay(LATENCY_MS)

  const products = await getAllProducts()
  const rows = products.map(toRow).filter((row) => matches(row, query))
  return { items: rows, total: rows.length }
}

/** Corrige os quatro números de um produto, um de cada vez. */
export async function updateStockRow(productId: string, values: StockValues): Promise<void> {
  await updateProductStock(productId, values)
}

/**
 * Adiciona uma linha à mão.
 *
 * Passa pelo mesmo `bulkUpsertStock` da importação, com uma linha só: SKU
 * conhecido atualiza os números, SKU desconhecido cria o produto como pendente
 * de cadastro. Dois caminhos separados poderiam divergir sobre o que fazer com
 * um SKU que ninguém conhece — e divergir aqui significaria a planilha e o
 * formulário deixarem a base em estados diferentes.
 */
export async function addStockRow(row: StockImportRow): Promise<void> {
  await bulkUpsertStock([row])
}
