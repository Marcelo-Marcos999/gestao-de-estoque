/**
 * Acesso a dados da tela de Estoque.
 *
 * Não guarda nada próprio: a fonte é o cadastro de produtos (`@/features/products`),
 * que já isola saldo, saídas, custo e venda do que é identidade (SKU,
 * descrição, código de barras). Esta tela só olha esses quatro números de um
 * ângulo diferente e sabe importá-los em massa.
 */
import { getAllProducts, updateProductStock, type Product, type StockValues } from '@/features/products'
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
