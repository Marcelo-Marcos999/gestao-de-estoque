/**
 * Camada de acesso a dados do cadastro de produtos.
 *
 * PROVISÓRIO: resolve tudo em memória, com volume parecido com o real (~26 mil
 * produtos) para que a interface seja construída contra o problema verdadeiro,
 * não contra uma lista de dez itens. Quando o back-end existir, só este arquivo
 * muda.
 */
import { matchesRange } from '@/shared/lib/numberRange'
import { generateProducts } from './demoData'
import type { Product, ProductDraft, ProductQuery } from './types'

const LATENCY_MS = 180

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let store: Product[] = generateProducts(26680)

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
  await delay(LATENCY_MS)
  const items = store.filter((p) => matches(p, query))
  return { items, total: items.length }
}

export async function countProducts(): Promise<number> {
  await delay(30)
  return store.length
}

/** Um produto pelo id, para quem já guardou a referência e precisa do saldo atual. */
export async function getProduct(id: string): Promise<Product | null> {
  await delay(30)
  return store.find((p) => p.id === id) ?? null
}

export async function getAllProducts(): Promise<Product[]> {
  await delay(30)
  return store
}

/* ---- Escrita -------------------------------------------------------------- */

export type SaveError = 'sku_duplicado' | 'barras_duplicado'

export type SaveResult =
  | { data: Product; error: null }
  | { data: null; error: SaveError }

function conflict(draft: ProductDraft, ignoreId?: string): SaveError | null {
  for (const product of store) {
    if (product.id === ignoreId) continue
    if (product.sku === draft.sku) return 'sku_duplicado'
    if (draft.barcode && product.barcode === draft.barcode) return 'barras_duplicado'
  }
  return null
}

export async function createProduct(draft: ProductDraft): Promise<SaveResult> {
  await delay(LATENCY_MS)

  const error = conflict(draft)
  if (error) return { data: null, error }

  const now = new Date().toISOString()
  // Produto criado à mão nasce sem saldo: quem traz esses números é a
  // importação do relatório, ou o usuário depois.
  const product: Product = {
    id: `p${draft.sku}-${now}`,
    ...draft,
    stock: 0,
    outflow: 0,
    costPrice: 0,
    salePrice: 0,
    pendingCadastro: false,
    createdAt: now,
    updatedAt: now,
  }
  store = [product, ...store]
  return { data: product, error: null }
}

export async function updateProduct(id: string, draft: ProductDraft): Promise<SaveResult> {
  await delay(LATENCY_MS)

  const error = conflict(draft, id)
  if (error) return { data: null, error }

  const index = store.findIndex((p) => p.id === id)
  if (index === -1) return { data: null, error: 'sku_duplicado' }

  const updated: Product = { ...store[index], ...draft, updatedAt: new Date().toISOString() }
  store = [...store.slice(0, index), updated, ...store.slice(index + 1)]
  return { data: updated, error: null }
}

/** Números do produto que a tela de Estoque importa ou corrige à mão. */
export interface StockValues {
  stock: number
  outflow: number
  costPrice: number
  salePrice: number
}

/**
 * Corrige saldo, saídas e valores de um produto.
 *
 * Separado de `updateProduct` porque são coisas de origens diferentes: SKU,
 * descrição e código de barras são cadastro; estes quatro números vêm da
 * importação dos relatórios (tela de Estoque) e podem ser ajustados à mão
 * quando o relatório não bate com a prateleira — ou enquanto não há
 * importação nenhuma.
 *
 * Aceita qualquer subconjunto dos quatro campos: quem chama pode ter só saldo
 * e saídas em mãos (ver docs/dominio.md, "três fontes"), e os que faltam
 * continuam com o valor que já tinham em vez de zerar.
 *
 * Valem para o **produto**, não para um lote: é o mesmo número que a tela de
 * quebra usa para saber se o item ainda está no estoque.
 */
export async function updateProductStock(
  id: string,
  values: Partial<StockValues>,
): Promise<void> {
  await delay(LATENCY_MS)

  // Negativo não existe em prateleira nem em preço; seria um número que a
  // previsão ou a tela de estoque aceitariam e exibiriam sem sentido.
  const semNegativo = (n: number) => Math.max(0, n)

  store = store.map((p) =>
    p.id === id
      ? {
          ...p,
          stock: values.stock !== undefined ? Math.round(semNegativo(values.stock)) : p.stock,
          outflow:
            values.outflow !== undefined ? Math.round(semNegativo(values.outflow)) : p.outflow,
          costPrice: values.costPrice !== undefined ? semNegativo(values.costPrice) : p.costPrice,
          salePrice: values.salePrice !== undefined ? semNegativo(values.salePrice) : p.salePrice,
          updatedAt: new Date().toISOString(),
        }
      : p,
  )
}

export async function deleteProduct(id: string): Promise<void> {
  await delay(LATENCY_MS)
  store = store.filter((p) => p.id !== id)
}

/**
 * Grava os produtos novos da importação, informando o progresso.
 *
 * Processa em lotes e devolve o controle ao navegador entre eles: sem isso,
 * inserir milhares de linhas trava a interface e a barra de progresso não
 * chega a ser desenhada.
 */
export async function bulkCreate(
  drafts: ProductDraft[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const BATCH = 500
  const now = new Date().toISOString()
  const created: Product[] = []

  for (let i = 0; i < drafts.length; i += BATCH) {
    for (const draft of drafts.slice(i, i + BATCH)) {
      created.push({
        id: `p${draft.sku}-${now}-${created.length}`,
        ...draft,
        stock: 0,
        outflow: 0,
        costPrice: 0,
        salePrice: 0,
        pendingCadastro: false,
        createdAt: now,
        updatedAt: now,
      })
    }

    onProgress?.(Math.min(i + BATCH, drafts.length), drafts.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  store = [...created, ...store]
  return created.length
}

/** Para `stockImport.ts`: mesmo `store`, sem expor a variável em si. */
export function getStoreSnapshot(): Product[] {
  return store
}

export function replaceStore(next: Product[]): void {
  store = next
}
