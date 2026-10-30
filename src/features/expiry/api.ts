/**
 * Acesso a dados do acompanhamento de validades.
 *
 * Os lotes moram no back-end (`/validades`); descrição, saldo, saídas e custo
 * são lidos do produto na hora, nunca copiados para o lote. A situação de cada
 * item é calculada na leitura, nunca gravada — guardá-la deixaria a tela
 * mentindo no dia seguinte, quando o produto já teria mudado de faixa sem
 * ninguém tocar nele (ver docs/dominio.md).
 *
 * Não existe base de exemplo: a lista começa vazia e só mostra o que a loja
 * lançou. Dados sorteados numa tela de produção fazem o usuário duvidar de
 * todo número que vê.
 */
import { getAllProducts } from '@/features/products'
import type { Product } from '@/features/products'
import type { IsoDate } from '@/shared/lib/date'
import { matchesDateRange } from '@/shared/lib/dateRange'
import { apiFetch } from '@/shared/lib/http'
import { lineTotal } from '@/shared/lib/money'
import { matchesRange } from '@/shared/lib/numberRange'
import { classify, type Situation } from './situation'
import type { ExpiryItem, ExpiryQuery, ExpiryRow } from './types'

/** O lote como o back-end o entrega. */
interface LoteApi {
  id: string
  produto_id: string
  data_validade: IsoDate | null
  criado_em: string
}

function paraExpiryItem(lote: LoteApi): ExpiryItem {
  return {
    id: lote.id,
    productId: lote.produto_id,
    expiryDate: lote.data_validade,
    createdAt: lote.criado_em,
  }
}

async function loadItems(): Promise<ExpiryItem[]> {
  const lotes = await apiFetch<LoteApi[]>('/validades')
  return lotes.map(paraExpiryItem)
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
    costPrice: product.costPrice,
    totalCost: lineTotal(product.stock, product.costPrice),
    situation,
    daysToExpiry,
    daysToZero,
  }
}

function matches(row: ExpiryRow, query: ExpiryQuery): boolean {
  if (query.situations.length && !query.situations.includes(row.situation)) return false
  if (!matchesRange(row.stock, query.numberRanges.stock)) return false
  if (!matchesRange(row.outflow, query.numberRanges.outflow)) return false
  if (!matchesRange(row.costPrice, query.numberRanges.costPrice)) return false
  if (!matchesRange(row.totalCost, query.numberRanges.totalCost)) return false
  if (!matchesDateRange(row.expiryDate, query.expiryRange)) return false

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
  const [items, products] = await Promise.all([loadItems(), getAllProducts()])
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
  await apiFetch(`/validades/${id}`, { method: 'PATCH', body: { dataValidade: expiryDate } })
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
 *
 * Devolve `true` quando criou de fato. Para a quebra isso é indiferente — ela
 * só quer que o lote exista —, mas quem cria um lote à mão precisa saber que
 * ele já existia, senão a tela ficaria igual depois de salvar e pareceria que
 * nada aconteceu.
 */
export async function ensureExpiryItem(
  productId: string,
  expiryDate: IsoDate | null,
): Promise<boolean> {
  if (!productId || !expiryDate) return false

  const { criado } = await apiFetch<{ id: string; criado: boolean }>('/validades', {
    method: 'POST',
    body: { produtoId: productId, dataValidade: expiryDate },
  })
  return criado
}

/** Exclui um ou vários lotes de uma vez, devolvendo o que saiu. */
export async function deleteExpiryItems(ids: string[]): Promise<ExpiryItem[]> {
  if (ids.length === 0) return []

  const removidos = await apiFetch<LoteApi[]>('/validades', { method: 'DELETE', body: { ids } })
  return removidos.map(paraExpiryItem)
}

/** Devolve lotes excluídos ao seu lugar — o "desfazer" da tela. */
export async function restoreExpiryItems(voltando: ExpiryItem[]): Promise<void> {
  if (voltando.length === 0) return

  await apiFetch('/validades/restaurar', {
    method: 'POST',
    body: {
      lotes: voltando.map((item) => ({
        id: item.id,
        produtoId: item.productId,
        dataValidade: item.expiryDate,
        criadoEm: item.createdAt,
      })),
    },
  })
}
