/**
 * Acesso a dados dos registros de quebra.
 *
 * PROVISÓRIO: em memória, como as demais features.
 *
 * A quantidade de um registro acompanha o saldo do produto: quando o saldo
 * zera, a quantidade zera junto e o usuário exclui o registro. Não há saldo
 * paralelo nem histórico de perdas — foi decisão consciente (ver
 * docs/dominio.md).
 */
import { getAllProducts } from '@/features/products'
import { ensureExpiryItem } from '@/features/expiry'
import type { LossRecord, LossRecordDraft, LossRecordQuery } from './types'

const LATENCY_MS = 180

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let store: LossRecord[] = []

/**
 * Um registro com a quantidade limitada ao saldo atual do produto.
 *
 * O saldo é do produto e as duas telas leem o mesmo número: se a importação
 * trouxe saldo 3 e o registro apontava 5, o que existe são 3. Saldo zerado
 * zera o registro.
 */
async function withCurrentStock(records: LossRecord[]): Promise<LossRecord[]> {
  const products = await getAllProducts()
  const stockById = new Map(products.map((p) => [p.id, p.stock]))

  return records.map((record) => {
    // Produto pendente ainda não tem cadastro, então não tem saldo para seguir.
    if (!record.productId) return record

    const stock = stockById.get(record.productId)
    if (stock === undefined) return record

    return { ...record, quantity: Math.min(record.quantity, stock) }
  })
}

export async function listLossRecords(query: LossRecordQuery): Promise<LossRecord[]> {
  await delay(LATENCY_MS)

  const records = await withCurrentStock(store)
  const term = query.search.trim().toLowerCase()

  return records
    .filter((record) => {
      if (query.stockState === 'no-estoque' && record.quantity <= 0) return false
      if (query.stockState === 'zerados' && record.quantity > 0) return false

      if (!term) return true
      return (
        record.sku.toLowerCase().includes(term) ||
        record.description.toLowerCase().includes(term) ||
        record.barcode.includes(term)
      )
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function countLossRecords(): Promise<{ total: number; inStock: number }> {
  const records = await withCurrentStock(store)
  return {
    total: records.length,
    inStock: records.filter((r) => r.quantity > 0).length,
  }
}

/**
 * Procura um registro com a mesma identidade: produto, validade e motivo.
 *
 * A chave importa. Avisando só por produto, o aviso dispararia o tempo todo —
 * e aviso que aparece sempre vira aviso que ninguém lê.
 */
export async function findSameRecord(
  draft: LossRecordDraft,
  /** Registro em edição: ele não pode se encontrar como duplicata de si mesmo. */
  ignoreId?: string,
): Promise<LossRecord | null> {
  await delay(80)

  const records = await withCurrentStock(store)
  const identity = draft.productId || draft.barcode

  return (
    records.find(
      (record) =>
        record.id !== ignoreId &&
        (record.productId || record.barcode) === identity &&
        record.expiryDate === draft.expiryDate &&
        record.reasonId === draft.reasonId,
    ) ?? null
  )
}

export async function createLossRecord(
  draft: LossRecordDraft,
  createdBy: string,
): Promise<LossRecord> {
  await delay(LATENCY_MS)

  const record: LossRecord = {
    id: `q${Date.now()}-${store.length}`,
    ...draft,
    createdAt: new Date().toISOString(),
    createdBy,
  }

  store = [record, ...store]

  // Apontar a perda de um lote é dizer que ele existe na loja: o
  // acompanhamento de validade passa a conhecê-lo, em vez de o produto sumir
  // da tela onde se vai conferir o saldo dele.
  await ensureExpiryItem(record.productId, record.expiryDate)

  return record
}

/** Soma a quantidade a um registro que já existe, em vez de criar outro. */
export async function addToRecord(id: string, quantity: number): Promise<void> {
  await delay(LATENCY_MS)
  store = store.map((r) => (r.id === id ? { ...r, quantity: r.quantity + quantity } : r))
}

export async function updateLossRecord(id: string, draft: LossRecordDraft): Promise<void> {
  await delay(LATENCY_MS)
  store = store.map((r) => (r.id === id ? { ...r, ...draft } : r))

  // A validade pode ter mudado na edição; o lote novo também precisa existir.
  await ensureExpiryItem(draft.productId, draft.expiryDate)
}

/**
 * Exclui um ou vários registros de uma vez, devolvendo o que saiu.
 *
 * Sempre em lote, mesmo para um só: a tela oferece seleção múltipla, e ter dois
 * caminhos de exclusão significaria dois lugares para o desfazer errar.
 */
export async function deleteLossRecords(ids: string[]): Promise<LossRecord[]> {
  await delay(LATENCY_MS)

  const alvos = new Set(ids)
  const removed = store.filter((r) => alvos.has(r.id))
  store = store.filter((r) => !alvos.has(r.id))
  return removed
}

/** Devolve registros excluídos ao seu lugar — o "desfazer" da tela. */
export async function restoreLossRecords(records: LossRecord[]): Promise<void> {
  await delay(80)

  const existentes = new Set(store.map((r) => r.id))
  const voltando = records.filter((r) => !existentes.has(r.id))
  if (voltando.length) store = [...voltando, ...store]
}
