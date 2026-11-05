/**
 * Acesso a dados dos Pedidos (`/pedidos`).
 *
 * Preço, custo e total de cada linha nascem NO SERVIDOR: a tela manda só produto,
 * quantidade e desconto, e mostra o que volta.
 */
import { apiFetch } from '@/shared/lib/http'
import type {
  Discount,
  Order,
  OrderLine,
  OrderQuery,
  OrderSummary,
  ProductPosition,
} from './types'

interface LinhaApi {
  id: string
  produto_id: string | null
  sku: string
  descricao: string
  codigo_barras: string
  quantidade: number
  // numeric do Postgres chega como string em JSON.
  preco_unitario: string
  custo_unitario: string
  desconto_tipo: 'percentual' | 'valor'
  desconto: string
  total: string
  custo: string
}

interface PedidoApi {
  id: string
  loja_id: string
  loja_nome: string
  numero: number
  cliente: string
  observacao: string
  status: 'aberto' | 'fechado'
  por: string
  criado_em: string
  fechado_em: string | null
  itens: number
  unidades: number
  total: string
  custo: string
}

type PedidoCompletoApi = PedidoApi & { linhas: LinhaApi[] }

function toLine(l: LinhaApi): OrderLine {
  return {
    id: l.id,
    productId: l.produto_id,
    sku: l.sku,
    description: l.descricao,
    barcode: l.codigo_barras,
    quantity: l.quantidade,
    unitPrice: Number(l.preco_unitario),
    unitCost: Number(l.custo_unitario),
    discount: { type: l.desconto_tipo === 'percentual' ? 'percent' : 'amount', value: Number(l.desconto) },
    total: Number(l.total),
    cost: Number(l.custo),
  }
}

function toSummary(p: PedidoApi): OrderSummary {
  return {
    id: p.id,
    storeId: p.loja_id,
    storeName: p.loja_nome,
    number: p.numero,
    customer: p.cliente,
    note: p.observacao,
    status: p.status === 'aberto' ? 'open' : 'closed',
    by: p.por,
    createdAt: p.criado_em,
    closedAt: p.fechado_em,
    itemCount: p.itens,
    unitCount: p.unidades,
    total: Number(p.total),
    cost: Number(p.custo),
  }
}

const toOrder = (p: PedidoCompletoApi): Order => ({ ...toSummary(p), lines: p.linhas.map(toLine) })

/**
 * `storeParam` é o `?loja=…` do escopo de loja da tela (vazio para o operador).
 * Devolve os `limit` pedidos mais novos e quantos existem no total.
 */
export async function listOrders(
  storeParam: string,
  query: OrderQuery,
  limit: number,
): Promise<{ orders: OrderSummary[]; total: number }> {
  const params = new URLSearchParams({ limite: String(limit) })
  if (query.search.trim()) params.set('busca', query.search.trim())
  if (query.status !== 'all') params.set('status', query.status === 'open' ? 'aberto' : 'fechado')

  // O escopo já vem como "?loja=…"; os demais filtros entram depois dele.
  const sep = storeParam ? '&' : '?'
  const { pedidos, total } = await apiFetch<{ pedidos: PedidoApi[]; total: number }>(
    `/pedidos${storeParam}${sep}${params.toString()}`,
  )
  return { orders: pedidos.map(toSummary), total }
}

export async function getOrder(id: string): Promise<Order> {
  return toOrder(await apiFetch<PedidoCompletoApi>(`/pedidos/${id}`))
}

/** `storeId` só para o administrador abrindo o pedido em nome de outra loja. */
export async function createOrder(customer: string, note: string, storeId?: string): Promise<Order> {
  return toOrder(
    await apiFetch<PedidoCompletoApi>(`/pedidos${storeId ? `?loja=${storeId}` : ''}`, {
      method: 'POST',
      body: { cliente: customer, observacao: note },
    }),
  )
}

export async function updateOrder(id: string, customer: string, note: string): Promise<Order> {
  return toOrder(
    await apiFetch<PedidoCompletoApi>(`/pedidos/${id}`, {
      method: 'PATCH',
      body: { cliente: customer, observacao: note },
    }),
  )
}

export async function deleteOrder(id: string): Promise<void> {
  await apiFetch(`/pedidos/${id}`, { method: 'DELETE' })
}

export async function closeOrder(id: string): Promise<Order> {
  return toOrder(await apiFetch<PedidoCompletoApi>(`/pedidos/${id}/fechar`, { method: 'POST' }))
}

export async function reopenOrder(id: string): Promise<Order> {
  return toOrder(await apiFetch<PedidoCompletoApi>(`/pedidos/${id}/reabrir`, { method: 'POST' }))
}

/** Saldo, venda e custo do produto NA LOJA DO PEDIDO (não na do login). */
export async function getProductPosition(orderId: string, productId: string): Promise<ProductPosition> {
  const p = await apiFetch<{
    tem_estoque: boolean
    saldo: number
    valor_venda: string
    valor_custo: string
    ja_no_pedido: number
  }>(`/pedidos/${orderId}/produtos/${productId}`)
  return {
    hasStock: p.tem_estoque,
    stock: p.saldo,
    salePrice: Number(p.valor_venda),
    costPrice: Number(p.valor_custo),
    alreadyInOrder: p.ja_no_pedido,
  }
}

const discountBody = (d: Discount) => ({
  descontoTipo: d.type === 'percent' ? 'percentual' : 'valor',
  desconto: d.value,
})

export async function addLine(
  orderId: string,
  productId: string,
  quantity: number,
  discount: Discount,
): Promise<Order> {
  return toOrder(
    await apiFetch<PedidoCompletoApi>(`/pedidos/${orderId}/itens`, {
      method: 'POST',
      body: { produtoId: productId, quantidade: quantity, ...discountBody(discount) },
    }),
  )
}

export async function updateLine(
  orderId: string,
  lineId: string,
  quantity: number,
  discount: Discount,
): Promise<Order> {
  return toOrder(
    await apiFetch<PedidoCompletoApi>(`/pedidos/${orderId}/itens/${lineId}`, {
      method: 'PATCH',
      body: { quantidade: quantity, ...discountBody(discount) },
    }),
  )
}

export async function removeLine(orderId: string, lineId: string): Promise<Order> {
  return toOrder(await apiFetch<PedidoCompletoApi>(`/pedidos/${orderId}/itens/${lineId}`, { method: 'DELETE' }))
}
