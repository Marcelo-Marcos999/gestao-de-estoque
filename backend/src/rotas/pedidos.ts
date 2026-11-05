import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'
import { lojaDaConsulta, lojaDaEscrita } from '../lib/lojas.js'
import { carregarPedido, PEDIDO_FECHADO, pedidoAberto, selecionarPedidos } from '../lib/pedidos.js'
import { rotasItensDoPedido } from './pedidosItens.js'

export const rotasPedidos = Router()

rotasPedidos.use(exigirAutenticacao)

/**
 * Pedidos (PD) de clientes.
 *
 * Quem enxerga o quê é decidido pela RLS, como no estoque e na auditoria: o
 * operador vê a própria loja; o administrador, as da conta (e escolhe com
 * `?loja=`). O PREÇO e o CUSTO de cada item são lidos do estoque DA LOJA DO
 * PEDIDO aqui no servidor, nunca recebidos da tela: ninguém monta um pedido com um
 * preço que o estoque não tem.
 *
 * Pedido FECHADO não aceita mudança nos itens. Para corrigir, reabre-se (e o
 * servidor, não a tela, é quem recusa — dois aparelhos podem estar com o mesmo
 * pedido aberto).
 */

const PADRAO_LIMITE = 50
const MAXIMO_LIMITE = 500

const consultaLista = z.object({
  status: z.enum(['aberto', 'fechado']).optional(),
  busca: z.string().trim().max(120).optional(),
  limite: z.coerce.number().int().min(1).max(MAXIMO_LIMITE).default(PADRAO_LIMITE),
})

/** Escapa `%`, `_` e `\` para a busca por nome tratar o que se digitou como texto. */
const comoTexto = (busca: string) => busca.replace(/[\\%_]/g, (c) => `\\${c}`)

rotasPedidos.get('/', assincrono(async (req, res) => {
  const consulta = consultaLista.safeParse(req.query)
  if (!consulta.success) {
    res.status(400).json({ erro: 'Filtro de pedidos inválido.' })
    return
  }
  const { status, busca, limite } = consulta.data
  // "12", "#12" e "PD 12" acham o pedido número 12; qualquer outro texto busca no cliente.
  const numero = busca?.match(/^(?:pd|#)?\s*(\d{1,9})$/i)?.[1] ?? null
  const filtros = [
    busca ? comoTexto(busca) : null,
    numero,
    status ?? null,
    lojaDaConsulta(req),
  ]
  const onde = `($4::uuid is null or p.loja_id = $4)
                and ($3::text is null or p.status = $3)
                and ($1::text is null or p.cliente ilike '%' || $1 || '%' or p.numero = $2::int)`

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(selecionarPedidos(onde, `limit ${limite}`), filtros)
    const { rows: contagem } = await client.query(
      `select count(*)::int as total from pedidos p where ${onde}`,
      filtros,
    )
    return { pedidos: rows, total: contagem[0].total as number }
  })
  res.json(resultado)
}))

const corpoPedido = z.object({
  cliente: z.string().trim().min(1).max(120),
  observacao: z.string().trim().max(500).default(''),
})

rotasPedidos.post('/', assincrono(async (req, res) => {
  const corpo = corpoPedido.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe o nome do cliente (até 120 letras).' })
    return
  }
  const loja = lojaDaEscrita(req, res)
  if (!loja) return

  const pedido = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      // O número vem do gatilho `pedidos_numerar`.
      `insert into pedidos (loja_id, cliente, observacao, criado_por_id) values ($1, $2, $3, $4)
       returning id`,
      [loja, corpo.data.cliente, corpo.data.observacao, req.loginId],
    )
    return carregarPedido(client, rows[0].id)
  })
  res.status(201).json(pedido)
}))

const parametroId = z.object({ id: z.string().uuid() })

rotasPedidos.get('/:id', assincrono(async (req, res) => {
  const ids = parametroId.safeParse(req.params)
  if (!ids.success) {
    res.status(400).json({ erro: 'Pedido inválido.' })
    return
  }
  const pedido = await comContextoDoUsuario(req.sessao!, (client) => carregarPedido(client, ids.data.id))
  if (!pedido) {
    res.status(404).json({ erro: 'Pedido não encontrado.' })
    return
  }
  res.json(pedido)
}))

/**
 * O que a tela mostra ao escolher o produto: saldo, preço de venda e custo no
 * estoque da loja DESTE pedido, e quanto do produto o pedido já tem. Só leitura:
 * o servidor lê tudo de novo ao gravar o item.
 */
rotasPedidos.get('/:id/produtos/:produtoId', assincrono(async (req, res) => {
  const lidos = z.object({ id: z.string().uuid(), produtoId: z.string().uuid() }).safeParse(req.params)
  if (!lidos.success) {
    res.status(400).json({ erro: 'Produto inválido.' })
    return
  }
  const posicao = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select (e.produto_id is not null) as tem_estoque,
              coalesce(e.saldo, 0) as saldo, coalesce(e.valor_venda, 0) as valor_venda,
              coalesce(e.valor_custo, 0) as valor_custo,
              coalesce((select sum(i.quantidade) from pedido_itens i
                        where i.pedido_id = pd.id and i.produto_id = p.id), 0)::int as ja_no_pedido
       from pedidos pd
       join produtos p on p.id = $2
       left join estoque e on e.loja_id = pd.loja_id and e.produto_id = p.id
       where pd.id = $1`,
      [lidos.data.id, lidos.data.produtoId],
    )
    return rows[0] ?? null
  })
  if (!posicao) {
    res.status(404).json({ erro: 'Pedido ou produto não encontrado.' })
    return
  }
  res.json(posicao)
}))

/** Os itens ficam num arquivo próprio (`/pedidos/:id/itens`). */
rotasPedidos.use('/:id/itens', rotasItensDoPedido)

/** Corrige o cliente e a observação — só com o pedido aberto, como os itens. */
rotasPedidos.patch('/:id', assincrono(async (req, res) => {
  const ids = parametroId.safeParse(req.params)
  const corpo = corpoPedido.safeParse(req.body)
  if (!ids.success || !corpo.success) {
    res.status(400).json({ erro: 'Informe o nome do cliente (até 120 letras).' })
    return
  }

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const status = await pedidoAberto(client, ids.data.id)
    if (!status) return { falha: 404 as const }
    if (status === 'fechado') return { falha: 409 as const }
    await client.query('update pedidos set cliente = $2, observacao = $3 where id = $1', [
      ids.data.id,
      corpo.data.cliente,
      corpo.data.observacao,
    ])
    return { pedido: await carregarPedido(client, ids.data.id) }
  })

  if ('pedido' in resultado) res.json(resultado.pedido)
  else if (resultado.falha === 404) res.status(404).json({ erro: 'Pedido não encontrado.' })
  else res.status(409).json(PEDIDO_FECHADO)
}))

/**
 * Fecha o pedido: daqui em diante o total é o que o cliente vai pagar. Um pedido
 * sem itens não fecha — seria um pedido de R$ 0,00 que ninguém quis fazer.
 * Fechar um pedido já fechado devolve o pedido como está (dois toques seguidos
 * no botão não podem virar erro).
 */
rotasPedidos.post('/:id/fechar', assincrono(async (req, res) => {
  const ids = parametroId.safeParse(req.params)
  if (!ids.success) {
    res.status(400).json({ erro: 'Pedido inválido.' })
    return
  }

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const status = await pedidoAberto(client, ids.data.id)
    if (!status) return { falha: 404 as const }
    if (status === 'aberto') {
      const { rows } = await client.query('select count(*)::int as n from pedido_itens where pedido_id = $1', [
        ids.data.id,
      ])
      if (rows[0].n === 0) return { falha: 409 as const }
      await client.query("update pedidos set status = 'fechado', fechado_em = now() where id = $1", [ids.data.id])
    }
    return { pedido: await carregarPedido(client, ids.data.id) }
  })

  if ('pedido' in resultado) res.json(resultado.pedido)
  else if (resultado.falha === 404) res.status(404).json({ erro: 'Pedido não encontrado.' })
  else res.status(409).json({ erro: 'Adicione ao menos um item antes de fechar o pedido.', codigo: 'pedido_vazio' })
}))

/** Reabre o pedido para corrigir os itens; o total volta a valer só ao fechar de novo. */
rotasPedidos.post('/:id/reabrir', assincrono(async (req, res) => {
  const ids = parametroId.safeParse(req.params)
  if (!ids.success) {
    res.status(400).json({ erro: 'Pedido inválido.' })
    return
  }

  const pedido = await comContextoDoUsuario(req.sessao!, async (client) => {
    if (!(await pedidoAberto(client, ids.data.id))) return null
    await client.query("update pedidos set status = 'aberto', fechado_em = null where id = $1", [ids.data.id])
    return carregarPedido(client, ids.data.id)
  })
  if (!pedido) {
    res.status(404).json({ erro: 'Pedido não encontrado.' })
    return
  }
  res.json(pedido)
}))

/**
 * Exclui um pedido ABERTO (os itens saem junto). Um pedido fechado é um
 * combinado com o cliente: para apagá-lo é preciso reabrir antes, de propósito —
 * é o degrau que evita excluir o pedido errado num toque.
 */
rotasPedidos.delete('/:id', assincrono(async (req, res) => {
  const ids = parametroId.safeParse(req.params)
  if (!ids.success) {
    res.status(400).json({ erro: 'Pedido inválido.' })
    return
  }

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const status = await pedidoAberto(client, ids.data.id)
    if (!status) return 404
    if (status === 'fechado') return 409
    await client.query('delete from pedidos where id = $1', [ids.data.id])
    return 204
  })

  if (resultado === 404) res.status(404).json({ erro: 'Pedido não encontrado.' })
  else if (resultado === 409) res.status(409).json({ erro: 'Reabra o pedido antes de excluí-lo.', codigo: 'pedido_fechado' })
  else res.status(204).end()
}))
