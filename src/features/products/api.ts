/**
 * Camada de acesso a dados do cadastro de produtos.
 *
 * Fala com o back-end de verdade. Um `Product` daqui é a junção de duas
 * rotas — GET /produtos (catálogo da conta) e GET /estoque (números da
 * loja de quem está logado) — feita em `store.ts`, junto do cache que
 * evita refazer as duas chamadas em toda função deste arquivo.
 */
import { ApiError, apiFetch } from '@/shared/lib/http'
import { matchesRange } from '@/shared/lib/numberRange'
import { carregar, invalidar, paraProduct, type EstoqueApi, type ProdutoApi } from './store'
import type { Product, ProductDraft, ProductQuery } from './types'

/* ---- Consultas ----------------------------------------------------------- */

function matches(product: Product, query: ProductQuery): boolean {
  if (query.onlyWithoutBarcode && product.barcode) return false
  if (query.onlyPending && !product.pendingCadastro) return false
  if (!matchesRange(product.stock, query.numberRanges.stock)) return false
  if (!matchesRange(product.outflow, query.numberRanges.outflow)) return false
  if (!matchesRange(product.costPrice, query.numberRanges.costPrice)) return false
  if (!matchesRange(product.salePrice, query.numberRanges.salePrice)) return false
  if (!query.search) return true

  const term = query.search.trim().toLowerCase()
  if (!term) return true

  return (
    product.sku.toLowerCase().includes(term) ||
    product.description.toLowerCase().includes(term) ||
    product.barcode.includes(term)
  )
}

export interface ProductPage {
  items: Product[]
  /** Total que atende ao filtro, não o total da base. */
  total: number
}

export async function listProducts(query: ProductQuery): Promise<ProductPage> {
  const store = await carregar()
  const items = store.filter((p) => matches(p, query))
  return { items, total: items.length }
}

export async function countProducts(): Promise<number> {
  return (await carregar()).length
}

/** Um produto pelo id, para quem já guardou a referência e precisa do saldo atual. */
export async function getProduct(id: string): Promise<Product | null> {
  const store = await carregar()
  return store.find((p) => p.id === id) ?? null
}

export async function getAllProducts(): Promise<Product[]> {
  return carregar()
}

/* ---- Escrita -------------------------------------------------------------- */

export type SaveError = 'sku_duplicado' | 'barras_duplicado'

export type SaveResult =
  | { data: Product; error: null }
  | { data: null; error: SaveError }

function comoSaveError(erro: unknown): SaveError | null {
  if (erro instanceof ApiError && erro.status === 409) {
    return (erro.codigo as SaveError | undefined) ?? 'sku_duplicado'
  }
  return null
}

export async function createProduct(draft: ProductDraft): Promise<SaveResult> {
  try {
    const produto = await apiFetch<ProdutoApi>('/produtos', {
      method: 'POST',
      body: { sku: draft.sku, descricao: draft.description, codigoBarras: draft.barcode || undefined },
    })
    invalidar()
    // Nasce sem saldo (nenhuma loja lançou estoque dele ainda) — paraProduct
    // sem segundo argumento já cobre isso com os quatro números em zero.
    return { data: paraProduct(produto), error: null }
  } catch (erro) {
    const saveError = comoSaveError(erro)
    if (saveError) return { data: null, error: saveError }
    throw erro
  }
}

export async function updateProduct(id: string, draft: ProductDraft): Promise<SaveResult> {
  try {
    const produto = await apiFetch<ProdutoApi>(`/produtos/${id}`, {
      method: 'PATCH',
      body: { sku: draft.sku, descricao: draft.description, codigoBarras: draft.barcode || undefined },
    })
    invalidar()
    // Preserva os números de estoque que essa loja já tinha pra esse
    // produto — PATCH /produtos só devolve o lado do catálogo.
    const anterior = (await carregar()).find((p) => p.id === id)
    // Só se já tinha posição de estoque: sem isto, editar a descrição de um
    // produto que nunca entrou no estoque o faria aparecer lá com zeros.
    const estoqueAnterior: EstoqueApi | undefined = anterior?.inStock
      ? {
          produto_id: id,
          saldo: anterior.stock,
          saidas: anterior.outflow,
          valor_custo: String(anterior.costPrice),
          valor_venda: String(anterior.salePrice),
        }
      : undefined
    return { data: paraProduct(produto, estoqueAnterior), error: null }
  } catch (erro) {
    const saveError = comoSaveError(erro)
    if (saveError) return { data: null, error: saveError }
    throw erro
  }
}

/** Números do produto que a tela de Estoque importa ou corrige à mão. */
export interface StockValues {
  stock: number
  outflow: number
  costPrice: number
  salePrice: number
}

/**
 * Corrige saldo, saídas e valores de um produto, na loja de quem está
 * logado — ver cabeçalho do arquivo pra por que estoque é por loja.
 *
 * Aceita qualquer subconjunto dos quatro campos; o `PATCH /estoque/:id` do
 * back-end faz o mesmo upsert com `coalesce` que esta função fazia em
 * memória.
 */
export async function updateProductStock(
  id: string,
  values: Partial<StockValues>,
  /** A loja a corrigir, quando não é a do próprio login (só o administrador). */
  storeId?: string,
): Promise<void> {
  await apiFetch(`/estoque/${id}${storeId ? `?loja=${storeId}` : ''}`, {
    method: 'PATCH',
    body: {
      saldo: values.stock,
      saidas: values.outflow,
      valorCusto: values.costPrice,
      valorVenda: values.salePrice,
    },
  })
  invalidar()
}

/** O que o servidor aceita por chamada; 2000 ids mantêm o corpo bem abaixo do limite de 1 MB. */
const DELETE_BATCH = 2000

export interface DeleteProductsResult {
  /** Os que saíram de verdade, inteiros, para o "desfazer". */
  removed: Product[]
  /** Pedidos que ficaram: produtos com estoque, quando `withStock` é falso. */
  keptIds: string[]
}

/**
 * Exclui um ou vários produtos, em lotes, devolvendo o que saiu e o que ficou.
 *
 * Um produto com estoque em alguma loja não é excluído a menos que `withStock`
 * seja verdadeiro (ver `DELETE /produtos` no back-end). Antes isso era
 * silencioso — a resposta só vinha com menos itens — e a tela parecia ignorar o
 * clique; agora quem chama recebe `keptIds` e pode explicar e perguntar.
 */
export async function deleteProducts(
  ids: string[],
  withStock = false,
): Promise<DeleteProductsResult> {
  const antes = await carregar()
  const removedIds = new Set<string>()

  try {
    for (let i = 0; i < ids.length; i += DELETE_BATCH) {
      const removidos = await apiFetch<Array<{ id: string }>>('/produtos', {
        method: 'DELETE',
        body: { ids: ids.slice(i, i + DELETE_BATCH), comEstoque: withStock },
      })
      for (const p of removidos) removedIds.add(p.id)
    }
  } finally {
    // Também quando falha no meio: os lotes anteriores já saíram.
    invalidar()
  }

  return {
    removed: antes.filter((p) => removedIds.has(p.id)),
    keptIds: ids.filter((id) => !removedIds.has(id)),
  }
}

/** Devolve produtos excluídos ao seu lugar — o "desfazer" da tela. */
export async function restoreProducts(products: Product[]): Promise<void> {
  if (!products.length) return

  await apiFetch('/produtos/restaurar', {
    method: 'POST',
    body: {
      produtos: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        descricao: p.description,
        codigoBarras: p.barcode || undefined,
        pendingCadastro: p.pendingCadastro,
      })),
    },
  })
  invalidar()
}

/**
 * Grava os produtos novos da importação, informando o progresso.
 *
 * Processa em lotes de 500 — o mesmo tamanho que o back-end aceita por
 * chamada (`POST /produtos/importar-lote`) — e devolve o controle ao
 * navegador entre eles, pra barra de progresso aparecer durante uma
 * importação de milhares de linhas, não só no fim.
 */
export async function bulkCreate(
  drafts: ProductDraft[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const BATCH = 500
  let total = 0

  try {
    for (let i = 0; i < drafts.length; i += BATCH) {
      const lote = drafts.slice(i, i + BATCH)
      const { criados } = await apiFetch<{ criados: number }>('/produtos/importar-lote', {
        method: 'POST',
        body: {
          produtos: lote.map((d) => ({
            sku: d.sku,
            descricao: d.description,
            codigoBarras: d.barcode || undefined,
          })),
        },
      })
      total += criados

      onProgress?.(Math.min(i + BATCH, drafts.length), drafts.length)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally {
    // Também quando falha no meio: os lotes anteriores já foram gravados, e a
    // lista em cache não os conhece.
    invalidar()
  }

  return total
}

/** Pra `stockImport.ts` avisar que os números de estoque mudaram por fora desta feature. */
export function invalidateStore(): void {
  invalidar()
}
