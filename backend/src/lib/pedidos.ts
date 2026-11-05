import type { PoolClient } from 'pg'

/**
 * Total de UMA linha do pedido, em SQL.
 *
 * Vive só aqui, no banco, e as telas mostram o que ele devolve: o mesmo cálculo
 * escrito em SQL e em JavaScript arredondaria meio centavo de jeitos diferentes, e
 * o total na tela divergiria do que a lista de pedidos soma.
 */
export const TOTAL_DA_LINHA = `case i.desconto_tipo
    when 'percentual' then round(i.quantidade * i.preco_unitario * (1 - i.desconto / 100), 2)
    else round(i.quantidade * i.preco_unitario - i.desconto, 2)
  end`

/** Custo da linha: o que o produto custou à loja, sem desconto nenhum. */
export const CUSTO_DA_LINHA = 'round(i.quantidade * i.custo_unitario, 2)'

export interface PedidoResumo {
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

/**
 * Os pedidos com os totais já somados (uma ida ao banco). `where` e `limite`
 * são SQL escrito aqui no servidor, nunca texto vindo do cliente: o que o cliente
 * manda entra só pelos parâmetros.
 */
export function selecionarPedidos(where: string, limite = ''): string {
  return `select p.id, p.loja_id, lo.nome as loja_nome, p.numero, p.cliente, p.observacao, p.status,
                 quem.nome as por, p.criado_em, p.fechado_em,
                 coalesce(t.itens, 0) as itens, coalesce(t.unidades, 0) as unidades,
                 coalesce(t.total, 0) as total, coalesce(t.custo, 0) as custo
          from pedidos p
          join lojas lo on lo.id = p.loja_id
          join lojas quem on quem.id = p.criado_por_id
          left join lateral (
            select count(*)::int as itens, sum(i.quantidade)::int as unidades,
                   sum(${TOTAL_DA_LINHA}) as total, sum(${CUSTO_DA_LINHA}) as custo
            from pedido_itens i where i.pedido_id = p.id
          ) t on true
          where ${where}
          order by p.criado_em desc, p.numero desc ${limite}`
}

/** O pedido e as linhas dele, do jeito que a tela do pedido precisa. */
export async function carregarPedido(client: PoolClient, id: string) {
  const { rows } = await client.query<PedidoResumo>(selecionarPedidos('p.id = $1'), [id])
  if (rows.length === 0) return null

  const itens = await client.query(
    `select i.id, i.produto_id, i.sku, i.descricao, i.codigo_barras, i.quantidade,
            i.preco_unitario, i.custo_unitario, i.desconto_tipo, i.desconto,
            ${TOTAL_DA_LINHA} as total, ${CUSTO_DA_LINHA} as custo
     from pedido_itens i where i.pedido_id = $1
     order by i.criado_em, i.id`,
    [id],
  )
  return { ...rows[0], linhas: itens.rows }
}

/** Violação de CHECK: aqui, só pode ser um desconto que passa do valor do item. */
export function descontoInvalido(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === '23514'
}

/**
 * Trava o pedido até o fim da transação e diz se dá para mexer nos itens.
 *
 * A trava é o que impede "fechar" e "adicionar item" simultâneos de se
 * atravessarem: quem chega depois espera e então enxerga o pedido já fechado.
 */
export async function pedidoAberto(client: PoolClient, id: string): Promise<'aberto' | 'fechado' | null> {
  const { rows } = await client.query('select status from pedidos where id = $1 for update', [id])
  return rows[0]?.status ?? null
}

export const PEDIDO_FECHADO = {
  erro: 'O pedido está fechado. Reabra o pedido para alterar os itens.',
  codigo: 'pedido_fechado',
}
