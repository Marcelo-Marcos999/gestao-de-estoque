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
import { ensureExpiryItem } from '@/features/expiry'
import { apiFetch } from '@/shared/lib/http'
import { lineTotal } from '@/shared/lib/money'
import { matchesRange } from '@/shared/lib/numberRange'
import { paraAnexo, paraAnexoApi, type AnexoApi } from './attachments'
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
  loja_id: string
  loja_nome: string
  /** Estoque da loja do registro (a posição pode não existir). */
  saldo: number | null
  valor_custo: string | null
  /** Os anexos do registro (o arquivo em si se baixa à parte). */
  anexos: AnexoApi[]
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
    attachments: q.anexos.map(paraAnexo),
    costPrice: q.valor_custo === null ? null : Number(q.valor_custo),
    availableStock: q.saldo,
    totalCost: null,
    storeId: q.loja_id,
    storeName: q.loja_nome,
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
export async function loadRecords(storeParam = ''): Promise<LossRecord[]> {
  const registros = await apiFetch<QuebraApi[]>(`/quebras${storeParam}`)
  return registros.map(paraLossRecord)
}

/**
 * Os registros que a loja já tem do MESMO produto, achado por id, SKU ou código
 * de barras (um produto pendente não tem id no cadastro, só o que foi digitado).
 * Alimenta o aviso do formulário, então traz o registro cru: a quantidade
 * gravada, não a limitada ao saldo de hoje.
 */
export async function loadRecordsOfProduct(
  product: { productId: string; sku: string; barcode: string },
  /** `?loja=…` quando o registro será gravado na loja de outro; vazio é a do login. */
  storeParam = '',
): Promise<LossRecord[]> {
  const filtros = { produto: product.productId, sku: product.sku.trim(), barras: product.barcode.trim() }
  const informados = Object.entries(filtros).filter(([, valor]) => valor)
  // Sem nada para casar, o servidor devolveria a loja inteira: não é o que se quer.
  if (informados.length === 0) return []

  const consulta = new URLSearchParams(informados)
  return (await apiFetch<QuebraApi[]>(`/quebras${storeParam ? `${storeParam}&` : '?'}${consulta}`)).map(paraLossRecord)
}

/**
 * O registro com a quantidade limitada ao saldo atual do produto, e com o custo
 * do estoque.
 *
 * O saldo é do produto e as duas telas leem o mesmo número: se a importação
 * trouxe saldo 3 e o registro apontava 5, o que existe são 3. Saldo zerado zera
 * o registro. O custo segue a mesma regra — vem do estoque na hora de ler —,
 * então corrigir o custo na tela de Estoque corrige o total da perda.
 *
 * Os números são os do estoque DA LOJA do registro (o servidor os entrega junto):
 * o administrador vê registros de lojas diferentes, e o saldo e o custo de uma
 * não valem para a outra.
 */
function withCurrentStock(records: LossRecord[]): LossRecord[] {
  return records.map((record) => {
    // Produto pendente ainda não tem cadastro, então não tem saldo nem custo.
    if (!record.productId) return { ...record, costPrice: null, totalCost: null }

    const quantity = Math.min(record.quantity, record.availableStock ?? 0)
    const cost = record.costPrice ?? 0
    return { ...record, quantity, costPrice: cost, totalCost: lineTotal(quantity, cost) }
  })
}

export async function listLossRecords(
  query: LossRecordQuery,
  /** `?loja=…` do escopo de loja da tela; vazio para o operador. */
  storeParam = '',
): Promise<LossRecord[]> {
  const records = withCurrentStock(await loadRecords(storeParam))
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

export async function countLossRecords(storeParam = ''): Promise<{ total: number; inStock: number }> {
  const records = withCurrentStock(await loadRecords(storeParam))
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
  // Só procura entre os registros da loja onde este será gravado.
  const records = withCurrentStock(await loadRecords(draft.storeId ? `?loja=${draft.storeId}` : ''))
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

/**
 * Cria vários registros com o mesmo motivo e a mesma origem, de uma vez e tudo
 * ou nada. Todos na MESMA loja (`storeId`, ou a do login): o administrador que
 * registra em nome de outra loja manda `lojaId`, e o servidor grava o registro
 * nela, com ele como autor.
 */
async function createMany(
  drafts: LossRecordDraft[],
  reasonId: string,
  originId: string,
  storeId?: string,
) {
  const { ids } = await apiFetch<{ ids: string[] }>('/quebras', {
    method: 'POST',
    body: { motivoId: reasonId, origemId: originId, lojaId: storeId, itens: drafts.map(paraCorpo) },
  })

  // Apontar a perda de um lote é dizer que ele existe na loja: o
  // acompanhamento de validade passa a conhecê-lo, em vez de o produto sumir
  // da tela onde se vai conferir o saldo dele. Na loja do registro.
  for (const draft of drafts) await ensureExpiryItem(draft.productId, draft.expiryDate, storeId)
  return ids
}

/** Quem registrou é o login da sessão: o servidor não aceita autoria dita pelo cliente. */
export async function createLossRecord(draft: LossRecordDraft): Promise<string> {
  const [id] = await createMany([draft], draft.reasonId, draft.originId, draft.storeId)
  return id
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
  // chamada, e quem chama aqui escolheu uma para o grupo inteiro. Já a loja pode
  // variar (o administrador envia lotes de várias lojas de uma vez): uma
  // chamada por loja.
  const originId = drafts[0].originId
  const byStore = new Map<string | undefined, LossRecordDraft[]>()
  for (const draft of drafts) {
    const group = byStore.get(draft.storeId) ?? []
    group.push({ ...draft, reasonId })
    byStore.set(draft.storeId, group)
  }
  for (const [storeId, group] of byStore) await createMany(group, reasonId, originId, storeId)
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
  await ensureExpiryItem(draft.productId, draft.expiryDate, draft.storeId)
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
        // O desfazer devolve o registro à loja de origem, não à do administrador.
        lojaId: r.storeId,
        // O arquivo continua no bucket; só a linha do anexo precisa voltar.
        anexos: r.attachments.map(paraAnexoApi),
      })),
    },
  })
}
