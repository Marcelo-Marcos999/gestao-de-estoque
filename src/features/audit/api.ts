/**
 * Acesso a dados da Auditoria.
 *
 * A contagem mora no back-end (`/auditoria`), uma linha por registro; quem soma
 * é o servidor. O saldo, as saídas e os valores vêm do estoque DA MESMA LOJA na
 * leitura — nunca copiados para a contagem.
 */
import { apiFetch } from '@/shared/lib/http'
import type { AuditEntry, AuditQuery, AuditRow } from './types'

interface ParcelaApi {
  id: string
  quantidade: number
  por: string
  em: string
}

interface LinhaApi {
  loja_id: string
  loja_nome: string
  produto_id: string
  sku: string
  descricao: string
  codigo_barras: string | null
  contagem: number
  ultimo_em: string
  tem_estoque: boolean
  saldo: number
  saidas: number
  // numeric do Postgres chega como string em JSON.
  valor_custo: string
  valor_venda: string
  parcelas: ParcelaApi[]
}

function paraEntry(p: ParcelaApi): AuditEntry {
  return { id: p.id, quantity: p.quantidade, by: p.por, at: p.em }
}

function paraRow(l: LinhaApi): AuditRow {
  return {
    productId: l.produto_id,
    storeId: l.loja_id,
    storeName: l.loja_nome,
    sku: l.sku,
    description: l.descricao,
    barcode: l.codigo_barras ?? '',
    counted: l.contagem,
    lastAt: l.ultimo_em,
    hasStock: l.tem_estoque,
    stock: l.saldo,
    outflow: l.saidas,
    costPrice: Number(l.valor_custo),
    salePrice: Number(l.valor_venda),
    entries: l.parcelas.map(paraEntry),
  }
}

/** `storeParam` é o `?loja=…` do escopo de loja da tela; vazio é a loja do próprio login. */
export async function listAuditRows(storeParam = ''): Promise<AuditRow[]> {
  return (await apiFetch<LinhaApi[]>(`/auditoria${storeParam}`)).map(paraRow)
}

/** Filtra no cliente: a lista já veio inteira e a busca é por texto. */
export function matchesQuery(row: AuditRow, query: AuditQuery, difference: number): boolean {
  if (query.onlyDifferences && difference === 0) return false

  const term = query.search.trim().toLowerCase()
  if (!term) return true
  return (
    row.sku.toLowerCase().includes(term) ||
    row.description.toLowerCase().includes(term) ||
    row.barcode.includes(term)
  )
}

/**
 * Soma um registro à contagem do produto e devolve o novo total — para a tela
 * dizer "agora são 15" sem reler a lista. `storeId` só para o administrador
 * contando por outra loja.
 */
export async function addCount(
  productId: string,
  quantity: number,
  storeId?: string,
): Promise<number> {
  const { contagem } = await apiFetch<{ contagem: number }>(
    `/auditoria${storeId ? `?loja=${storeId}` : ''}`,
    { method: 'POST', body: { produtoId: productId, quantidade: quantity } },
  )
  return contagem
}

/** Remove uma parcela (um registro digitado errado). */
export async function removeEntry(entryId: string): Promise<void> {
  await apiFetch(`/auditoria/parcelas/${entryId}`, { method: 'DELETE' })
}

/** Zera a auditoria de uma loja: é como se começa uma nova contagem. */
export async function clearAudit(storeId?: string): Promise<number> {
  const { removidas } = await apiFetch<{ removidas: number }>(
    `/auditoria${storeId ? `?loja=${storeId}` : ''}`,
    { method: 'DELETE' },
  )
  return removidas
}
