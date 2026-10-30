/**
 * Acesso a dados dos registros de quebra.
 *
 * Fala com o back-end (`/quebras`). A quantidade de um registro acompanha o
 * saldo do produto: quando o saldo zera, a quantidade zera junto e o usuário
 * exclui o registro. Não há saldo paralelo nem histórico de perdas — foi
 * decisão consciente (ver docs/dominio.md).
 *
 * O servidor entrega todos os registros da loja e a busca, os filtros e a
 * ordenação acontecem aqui, como no cadastro de produtos: o saldo e o custo
 * vêm do estoque na hora de ler (`withCurrentStock`), e filtrar por eles no
 * servidor exigiria repetir lá a mesma conta.
 */
import { getAllProducts } from '@/features/products'
import { ensureExpiryItem } from '@/features/expiry'
import { apiFetch } from '@/shared/lib/http'
import { lineTotal } from '@/shared/lib/money'
import { matchesRange } from '@/shared/lib/numberRange'
import type { LossRecord, LossRecordDraft, LossRecordQuery } from './types'

/** O registro como o back-end o entrega. */
interface QuebraApi {
  id: string
  produto_id: string | null
  sku: string
  descricao: string
  codigo_barras: string
  pendente_produto: boolean
  data_validade: string | null
  quantidade: number
  motivo_id: string
  origem_id: string
  observacao: string
  criado_em: string
  criado_por_id: string
  criado_por: string
}

function paraLossRecord(q: QuebraApi): LossRecord {
  return {
    id: q.id,
    productId: q.produto_id ?? '',
    sku: q.sku,
    description: q.descricao,
    barcode: q.codigo_barras,
    pendingProduct: q.pendente_produto,
    expiryDate: q.data_validade,
    quantity: q.quantidade,
    reasonId: q.motivo_id,
    originId: q.origem_id,
    note: q.observacao,
    // Os arquivos ainda não têm onde morar no servidor: só o registro persiste.
    attachments: [],
    costPrice: null,
    totalCost: null,
    createdAt: q.criado_em,
    createdBy: q.criado_por,
    createdById: q.criado_por_id,
  }
}

/** O que o servidor recebe de um registro; igual na criação e na edição. */
function paraCorpo(draft: LossRecordDraft) {
  return {
    produtoId: draft.productId || null,
    sku: draft.sku,
    descricao: draft.description,
    codigoBarras: draft.barcode,
    pendente: draft.pendingProduct,
    dataValidade: draft.expiryDate,
    quantidade: draft.quantity,
    observacao: draft.note,
  }
}

/** Todos os registros da loja, crus — para quem precisa saber o que já existe (importação). */
export async function loadRecords(): Promise<LossRecord[]> {
  const registros = await apiFetch<QuebraApi[]>('/quebras')
  return registros.map(paraLossRecord)
}

/**
 * Um registro com a quantidade limitada ao saldo atual do produto, e com o
 * custo do estoque.
 *
 * O saldo é do produto e as duas telas leem o mesmo número: se a importação
 * trouxe saldo 3 e o registro apontava 5, o que existe são 3. Saldo zerado
 * zera o registro. O custo segue a mesma regra — vem do estoque na hora de
 * ler —, então corrigir o custo na tela de Estoque corrige o total da perda.
 */
async function withCurrentStock(records: LossRecord[]): Promise<LossRecord[]> {
  const products = await getAllProducts()
  const byId = new Map(products.map((p) => [p.id, p]))

  return records.map((record) => {
    // Produto pendente ainda não tem cadastro, então não tem saldo nem custo.
    const product = record.productId ? byId.get(record.productId) : undefined
    if (!product) return { ...record, costPrice: null, totalCost: null }

    const quantity = Math.min(record.quantity, product.stock)
    return {
      ...record,
      quantity,
      costPrice: product.costPrice,
      totalCost: lineTotal(quantity, product.costPrice),
    }
  })
}

export async function listLossRecords(query: LossRecordQuery): Promise<LossRecord[]> {
  const records = await withCurrentStock(await loadRecords())
  const term = query.search.trim().toLowerCase()

  return records
    .filter((record) => {
      if (query.stockState === 'no-estoque' && record.quantity <= 0) return false
      if (query.stockState === 'zerados' && record.quantity > 0) return false

      if (query.reasonIds.length > 0 && !query.reasonIds.includes(record.reasonId)) return false
      if (query.originIds.length > 0 && !query.originIds.includes(record.originId)) return false
      if (!matchesRange(record.quantity, query.numberRanges.quantity)) return false
      if (!matchesRange(record.costPrice, query.numberRanges.costPrice)) return false
      if (!matchesRange(record.totalCost, query.numberRanges.totalCost)) return false

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
  const records = await withCurrentStock(await loadRecords())
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
  const records = await withCurrentStock(await loadRecords())
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

/** Cria vários registros com o mesmo motivo e a mesma origem, de uma vez e tudo ou nada. */
async function createMany(drafts: LossRecordDraft[], reasonId: string, originId: string) {
  await apiFetch('/quebras', {
    method: 'POST',
    body: { motivoId: reasonId, origemId: originId, itens: drafts.map(paraCorpo) },
  })

  // Apontar a perda de um lote é dizer que ele existe na loja: o
  // acompanhamento de validade passa a conhecê-lo, em vez de o produto sumir
  // da tela onde se vai conferir o saldo dele.
  for (const draft of drafts) await ensureExpiryItem(draft.productId, draft.expiryDate)
}

/** Quem registrou é o login da sessão: o servidor não aceita autoria dita pelo cliente. */
export async function createLossRecord(draft: LossRecordDraft): Promise<void> {
  await createMany([draft], draft.reasonId, draft.originId)
}

/**
 * Cria vários registros de uma vez, todos com o mesmo motivo — casado pelo
 * **nome**, não por um id fixo, pela mesma razão do formulário: a lista de
 * motivos é editável, e "Vencido" pode ter sido renomeado (ver
 * docs/dominio.md).
 *
 * Existe para quem já sabe, sem perguntar, que o motivo é aquele — como a
 * tela de Validades enviando vários lotes vencidos de uma vez: pedir para
 * escolher o motivo de novo, um por um, seria perguntar o óbvio. A origem, ao
 * contrário, não se deduz: vem no rascunho de cada registro, escolhida por
 * quem enviou.
 */
export async function createLossRecordsByReasonLabel(
  drafts: Omit<LossRecordDraft, 'reasonId'>[],
  reasonLabel: string,
): Promise<void> {
  if (drafts.length === 0) return

  const motivos = await apiFetch<{ id: string; label: string }[]>('/motivos')
  const reasonId = motivos.find((m) => m.label.toLowerCase() === reasonLabel.toLowerCase())?.id
  if (!reasonId) {
    // Sem casar, gravar mesmo assim deixaria os registros sem motivo.
    throw new Error(`O motivo "${reasonLabel}" não existe mais na lista de motivos.`)
  }

  // A origem é uma só para o envio: o back-end aceita um par motivo+origem por
  // chamada, e quem chama aqui escolheu uma para o grupo inteiro.
  const originId = drafts[0].originId
  await createMany(
    drafts.map((draft) => ({ ...draft, reasonId })),
    reasonId,
    originId,
  )
}

/** Soma a quantidade a um registro que já existe, em vez de criar outro. */
export async function addToRecord(id: string, quantity: number): Promise<void> {
  await apiFetch(`/quebras/${id}/somar`, { method: 'POST', body: { quantidade: quantity } })
}

export async function updateLossRecord(id: string, draft: LossRecordDraft): Promise<void> {
  await apiFetch(`/quebras/${id}`, {
    method: 'PATCH',
    body: { ...paraCorpo(draft), motivoId: draft.reasonId, origemId: draft.originId },
  })

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
  const removidos = await apiFetch<QuebraApi[]>('/quebras', { method: 'DELETE', body: { ids } })
  return removidos.map(paraLossRecord)
}

/** Devolve registros excluídos ao seu lugar — o "desfazer" da tela. */
export async function restoreLossRecords(records: LossRecord[]): Promise<void> {
  if (records.length === 0) return

  await apiFetch('/quebras/restaurar', {
    method: 'POST',
    body: {
      registros: records.map((r) => ({
        id: r.id,
        ...paraCorpo(r),
        motivoId: r.reasonId,
        origemId: r.originId,
        criadoPorId: r.createdById,
        criadoEm: r.createdAt,
      })),
    },
  })
}
