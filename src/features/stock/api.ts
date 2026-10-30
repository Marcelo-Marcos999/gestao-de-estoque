/**
 * Acesso a dados da tela de Estoque.
 *
 * Não guarda nada próprio: a fonte é o cadastro de produtos (`@/features/products`),
 * que já isola saldo, saídas, custo e venda do que é identidade (SKU,
 * descrição, código de barras). Esta tela só olha esses quatro números de um
 * ângulo diferente e sabe importá-los em massa.
 */
import { bulkUpsertStock, updateProductStock, type StockImportRow, type StockValues } from '@/features/products'
import { apiFetch } from '@/shared/lib/http'
import { matchesRange } from '@/shared/lib/numberRange'
import { rowCostTotal, rowSaleTotal } from './totals'
import type { StockQuery, StockRow } from './types'

/** Uma posição de estoque como o servidor a entrega, já com a identidade do produto e a loja. */
interface PosicaoApi {
  produto_id: string
  sku: string
  descricao: string
  codigo_barras: string | null
  pendente_cadastro: boolean
  saldo: number
  saidas: number
  valor_custo: string
  valor_venda: string
  loja_id: string
  loja_nome: string
}

function toRow(p: PosicaoApi): StockRow {
  return {
    productId: p.produto_id,
    storeId: p.loja_id,
    storeName: p.loja_nome,
    sku: p.sku,
    description: p.descricao,
    barcode: p.codigo_barras ?? '',
    stock: p.saldo,
    outflow: p.saidas,
    // numeric do Postgres chega como string em JSON.
    costPrice: Number(p.valor_custo),
    salePrice: Number(p.valor_venda),
    pendingCadastro: p.pendente_cadastro,
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

/**
 * Só as posições de estoque que existem — não o cadastro inteiro. O cadastro
 * tem todos os produtos, muitos nunca entraram no estoque, e listá-los aqui,
 * com zeros, enchia a tela de "registros" que ninguém lançou (e fazia "Excluir
 * tudo" parecer não ter feito nada).
 *
 * `storeParam` é o `?loja=…` do escopo de loja da tela: o administrador vê uma
 * linha por produto e loja; vazio é só a loja do próprio login.
 */
export async function listStockRows(query: StockQuery, storeParam = ''): Promise<StockPage> {
  const posicoes = await apiFetch<PosicaoApi[]>(`/estoque${storeParam}`)
  const rows = posicoes.map(toRow).filter((row) => matches(row, query))
  return { items: rows, total: rows.length }
}

/** Corrige os quatro números de um produto numa loja (a do login, ou — administrador — a da linha). */
export async function updateStockRow(
  productId: string,
  values: StockValues,
  storeId?: string,
): Promise<void> {
  await updateProductStock(productId, values, storeId)
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
