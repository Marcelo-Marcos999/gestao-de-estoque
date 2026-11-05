import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { assincrono } from '../lib/assincrono.js'
import { carregarPedido, descontoInvalido, PEDIDO_FECHADO, pedidoAberto } from '../lib/pedidos.js'

/**
 * Itens de um pedido (`/pedidos/:id/itens`). `mergeParams` traz o `:id` do pedido
 * da rota-mãe.
 */
export const rotasItensDoPedido = Router({ mergeParams: true })

const idsDaRota = z.object({ id: z.string().uuid(), itemId: z.string().uuid().optional() })

const corpoItem = z.object({
  quantidade: z.number().int().min(1).max(1_000_000),
  descontoTipo: z.enum(['percentual', 'valor']).default('valor'),
  // Zero é "sem desconto". O teto real (não passar do valor da linha) é conferido
  // pelo banco, que é quem tem o preço.
  desconto: z.number().min(0).max(100_000_000).default(0),
})

const corpoNovoItem = corpoItem.extend({ produtoId: z.string().uuid() })

const DESCONTO_INVALIDO = { erro: 'O desconto não pode passar do valor do item.' }
const SEM_PRECO = {
  erro: 'Este produto não tem preço de venda no estoque desta loja. Lance o preço no Estoque antes de vendê-lo.',
  codigo: 'sem_preco',
}

rotasItensDoPedido.post('/', assincrono(async (req, res) => {
  const ids = idsDaRota.safeParse(req.params)
  const corpo = corpoNovoItem.safeParse(req.body)
  if (!ids.success || !corpo.success) {
    res.status(400).json({ erro: 'Informe o produto, a quantidade (1 ou mais) e o desconto.' })
    return
  }
  const { produtoId, quantidade, descontoTipo, desconto } = corpo.data

  try {
    const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
      const status = await pedidoAberto(client, ids.data.id)
      if (!status) return { falha: 404 as const }
      if (status === 'fechado') return { falha: 409 as const, corpo: PEDIDO_FECHADO }

      // Preço e custo do estoque da loja DESTE pedido, copiados para o item. O
      // `where valor_venda > 0` recusa o produto sem preço: um item de R$ 0,00 passaria
      // despercebido e o total do pedido sairia errado.
      const { rowCount } = await client.query(
        `insert into pedido_itens (pedido_id, produto_id, sku, descricao, codigo_barras, quantidade,
                                   preco_unitario, custo_unitario, desconto_tipo, desconto)
         select pd.id, p.id, p.sku, p.descricao, coalesce(p.codigo_barras, ''), $3,
                e.valor_venda, e.valor_custo, $4, $5
         from pedidos pd
         join produtos p on p.id = $2
         join estoque e on e.loja_id = pd.loja_id and e.produto_id = p.id and e.valor_venda > 0
         where pd.id = $1`,
        [ids.data.id, produtoId, quantidade, descontoTipo, desconto],
      )
      if (!rowCount) return { falha: 422 as const, corpo: SEM_PRECO }
      return { pedido: await carregarPedido(client, ids.data.id) }
    })

    if ('pedido' in resultado) res.status(201).json(resultado.pedido)
    else if (resultado.falha === 404) res.status(404).json({ erro: 'Pedido não encontrado.' })
    else res.status(resultado.falha).json(resultado.corpo)
  } catch (erro) {
    if (!descontoInvalido(erro)) throw erro
    res.status(400).json(DESCONTO_INVALIDO)
  }
}))

rotasItensDoPedido.patch('/:itemId', assincrono(async (req, res) => {
  const ids = idsDaRota.safeParse(req.params)
  const corpo = corpoItem.safeParse(req.body)
  if (!ids.success || !ids.data.itemId || !corpo.success) {
    res.status(400).json({ erro: 'Informe a quantidade (1 ou mais) e o desconto.' })
    return
  }
  const { itemId } = ids.data

  try {
    const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
      const status = await pedidoAberto(client, ids.data.id)
      if (!status) return { falha: 404 as const }
      if (status === 'fechado') return { falha: 409 as const, corpo: PEDIDO_FECHADO }

      // O preço NÃO muda aqui: continua o do dia em que o item entrou.
      const { rowCount } = await client.query(
        `update pedido_itens set quantidade = $3, desconto_tipo = $4, desconto = $5
         where id = $2 and pedido_id = $1`,
        [ids.data.id, itemId, corpo.data.quantidade, corpo.data.descontoTipo, corpo.data.desconto],
      )
      if (!rowCount) return { falha: 404 as const }
      return { pedido: await carregarPedido(client, ids.data.id) }
    })

    if ('pedido' in resultado) res.json(resultado.pedido)
    else if (resultado.falha === 404) res.status(404).json({ erro: 'Item não encontrado.' })
    else res.status(resultado.falha).json(resultado.corpo)
  } catch (erro) {
    if (!descontoInvalido(erro)) throw erro
    res.status(400).json(DESCONTO_INVALIDO)
  }
}))

rotasItensDoPedido.delete('/:itemId', assincrono(async (req, res) => {
  const ids = idsDaRota.safeParse(req.params)
  if (!ids.success || !ids.data.itemId) {
    res.status(400).json({ erro: 'Item inválido.' })
    return
  }
  const { itemId } = ids.data

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const status = await pedidoAberto(client, ids.data.id)
    if (!status) return { falha: 404 as const }
    if (status === 'fechado') return { falha: 409 as const, corpo: PEDIDO_FECHADO }

    const { rowCount } = await client.query('delete from pedido_itens where id = $2 and pedido_id = $1', [
      ids.data.id,
      itemId,
    ])
    if (!rowCount) return { falha: 404 as const }
    return { pedido: await carregarPedido(client, ids.data.id) }
  })

  if ('pedido' in resultado) res.json(resultado.pedido)
  else if (resultado.falha === 404) res.status(404).json({ erro: 'Item não encontrado.' })
  else res.status(resultado.falha).json(resultado.corpo)
}))
