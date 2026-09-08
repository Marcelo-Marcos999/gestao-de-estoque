/**
 * Acesso a dados do acompanhamento de validades.
 *
 * PROVISÓRIO: em memória, como as demais features. A situação de cada item é
 * calculada na leitura, nunca gravada — guardá-la deixaria a tela mentindo no
 * dia seguinte, quando o produto já teria mudado de faixa sem ninguém tocar
 * nele (ver docs/dominio.md).
 */
import { getAllProducts } from '@/features/products'
import type { Product } from '@/features/products'
import type { IsoDate } from '@/shared/lib/date'
import { classify, type Situation } from './situation'
import type { ExpiryItem, ExpiryQuery, ExpiryRow } from './types'

const LATENCY_MS = 180

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/* ---- Base de demonstração ------------------------------------------------ */

/** Gerador determinístico, como no cadastro: a mesma base a cada recarga. */
function pseudoRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

function isoFrom(base: Date, days: number): string {
  const d = new Date(base.getTime() + days * 86_400_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

let store: ExpiryItem[] | null = null

/**
 * Sorteia lotes entre os produtos existentes, com validades espalhadas do
 * passado até dois anos à frente, para as quatro faixas aparecerem.
 */
async function ensureStore(): Promise<ExpiryItem[]> {
  if (store) return store

  const products = await getAllProducts()
  const random = pseudoRandom(20260901)
  const hoje = new Date('2026-08-29T00:00:00Z')
  const items: ExpiryItem[] = []

  for (let i = 0; i < 341; i++) {
    const product = products[Math.floor(random() * products.length)]

    // De 200 dias atrás a 500 à frente; uma parte sem data, como no cadastro
    // real, onde ninguém preencheu ainda.
    const semData = random() > 0.94
    const offset = Math.floor(random() * 700) - 200

    items.push({
      id: `v${i}`,
      productId: product.id,
      expiryDate: semData ? null : isoFrom(hoje, offset),
      createdAt: hoje.toISOString(),
    })
  }

  store = items
  return store
}

/* ---- Consulta ------------------------------------------------------------ */

function toRow(item: ExpiryItem, product: Product, periodDays: number): ExpiryRow {
  const { situation, daysToExpiry, daysToZero } = classify({
    expiryDate: item.expiryDate,
    stock: product.stock,
    outflow: product.outflow,
    periodDays,
  })

  return {
    id: item.id,
    productId: product.id,
    sku: product.sku,
    description: product.description,
    barcode: product.barcode,
    expiryDate: item.expiryDate,
    stock: product.stock,
    outflow: product.outflow,
    situation,
    daysToExpiry,
    daysToZero,
  }
}

function matches(row: ExpiryRow, query: ExpiryQuery): boolean {
  if (query.situations.length && !query.situations.includes(row.situation)) return false

  const term = query.search.trim().toLowerCase()
  if (!term) return true

  return (
    row.sku.toLowerCase().includes(term) ||
    row.description.toLowerCase().includes(term) ||
    row.barcode.includes(term)
  )
}

export interface ExpiryPage {
  items: ExpiryRow[]
  /** Quantos atendem ao filtro. */
  total: number
  /** Total por situação, sempre da base inteira — os cartões não filtram a si mesmos. */
  counts: Record<Situation, number>
  /** Total acompanhado, independente de filtro. */
  overall: number
}

export async function listExpiryItems(
  query: ExpiryQuery,
  periodDays: number,
): Promise<ExpiryPage> {
  await delay(LATENCY_MS)

  const [items, products] = await Promise.all([ensureStore(), getAllProducts()])
  const byId = new Map(products.map((p) => [p.id, p]))

  const rows: ExpiryRow[] = []
  for (const item of items) {
    const product = byId.get(item.productId)
    if (product) rows.push(toRow(item, product, periodDays))
  }

  const counts: Record<Situation, number> = {
    venceu: 0,
    'vence-antes': 0,
    'vende-antes': 0,
    'sem-estimativa': 0,
  }
  for (const row of rows) counts[row.situation]++

  // Pior situação primeiro, e dentro dela o que vence antes: a tela abre já
  // mostrando o que precisa de decisão hoje.
  const ordem: Record<Situation, number> = {
    venceu: 0,
    'vence-antes': 1,
    'vende-antes': 2,
    'sem-estimativa': 3,
  }
  const filtered = rows.filter((row) => matches(row, query))
  filtered.sort((a, b) => {
    const diff = ordem[a.situation] - ordem[b.situation]
    if (diff !== 0) return diff
    return (a.daysToExpiry ?? Number.MAX_SAFE_INTEGER) - (b.daysToExpiry ?? Number.MAX_SAFE_INTEGER)
  })

  return { items: filtered, total: filtered.length, counts, overall: rows.length }
}

/* ---- Escrita -------------------------------------------------------------- */

/**
 * Corrige a validade de um lote.
 *
 * É o único campo que se edita aqui. Saldo e saídas são do **produto** e vêm
 * da importação dos relatórios: editá-los por dentro de um lote deixaria dois
 * lotes do mesmo produto discordando sobre quanto existe na loja (ver
 * docs/dominio.md).
 */
export async function updateExpiryItem(id: string, expiryDate: IsoDate | null): Promise<void> {
  await delay(LATENCY_MS)

  const items = await ensureStore()
  store = items.map((item) => (item.id === id ? { ...item, expiryDate } : item))
}

/**
 * Garante que exista um lote para este produto nesta validade.
 *
 * Quem chama é o registro de quebra: apontar uma perda de um lote é dizer que
 * aquele lote existe na loja. Sem isto, o produto apontado como vencido não
 * aparecia na tela de validades — e era justamente lá que se ia conferir o
 * saldo dele (ver docs/dominio.md).
 *
 * Sem data não há lote: um lote é produto **mais** validade, e sem ela não há
 * o que acompanhar.
 */
export async function ensureExpiryItem(
  productId: string,
  expiryDate: IsoDate | null,
): Promise<void> {
  if (!productId || !expiryDate) return

  const items = await ensureStore()
  const existe = items.some(
    (item) => item.productId === productId && item.expiryDate === expiryDate,
  )
  if (existe) return

  store = [
    {
      id: `v${Date.now()}-${items.length}`,
      productId,
      expiryDate,
      createdAt: new Date().toISOString(),
    },
    ...items,
  ]
}

/** Exclui um ou vários lotes de uma vez, devolvendo o que saiu. */
export async function deleteExpiryItems(ids: string[]): Promise<ExpiryItem[]> {
  await delay(LATENCY_MS)

  const items = await ensureStore()
  const alvos = new Set(ids)
  const removed = items.filter((item) => alvos.has(item.id))
  store = items.filter((item) => !alvos.has(item.id))
  return removed
}

/** Devolve lotes excluídos ao seu lugar — o "desfazer" da tela. */
export async function restoreExpiryItems(voltando: ExpiryItem[]): Promise<void> {
  await delay(80)

  const items = await ensureStore()
  const existentes = new Set(items.map((item) => item.id))
  const novos = voltando.filter((item) => !existentes.has(item.id))
  if (novos.length) store = [...novos, ...items]
}
