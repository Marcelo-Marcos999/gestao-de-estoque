import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'
import { lojaDaConsulta, lojaDaEscrita } from '../lib/lojas.js'

export const rotasAuditoria = Router()

rotasAuditoria.use(exigirAutenticacao)

/**
 * Auditoria de estoque: a contagem física de cada produto, comparada com o saldo.
 *
 * A contagem de um produto é a SOMA dos registros dele na loja (tabela
 * `contagens`, só se acrescenta). Por isso dois contadores se somam em vez de um
 * sobrescrever o outro: A registra 10, B registra 5, o produto passa a ter 15.
 *
 * Quem enxerga o quê é decidido pela RLS, como no estoque: o operador vê a
 * própria loja; o administrador, as da conta (e escolhe com `?loja=`); ninguém vê
 * outra conta. Estas rotas só escolhem a loja pedida.
 */

/**
 * Uma linha por (loja, produto), já com o saldo, as saídas e os valores do
 * ESTOQUE daquela loja (`left join`: um produto contado que a loja nunca lançou no
 * estoque aparece com zeros, em vez de sumir da conferência) e o histórico das
 * parcelas, para a tela mostrar quem contou o quê.
 */
rotasAuditoria.get('/', assincrono(async (req, res) => {
  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select c.loja_id, lo.nome as loja_nome, c.produto_id,
              p.sku, p.descricao, p.codigo_barras,
              sum(c.quantidade)::int as contagem,
              max(c.criado_em) as ultimo_em,
              (e.produto_id is not null) as tem_estoque,
              coalesce(e.saldo, 0) as saldo, coalesce(e.saidas, 0) as saidas,
              coalesce(e.valor_custo, 0) as valor_custo, coalesce(e.valor_venda, 0) as valor_venda,
              json_agg(json_build_object(
                'id', c.id, 'quantidade', c.quantidade,
                'por', quem.nome, 'em', c.criado_em) order by c.criado_em desc) as parcelas
       from contagens c
       join produtos p on p.id = c.produto_id
       join lojas lo on lo.id = c.loja_id
       join lojas quem on quem.id = c.criado_por_id
       left join estoque e on e.loja_id = c.loja_id and e.produto_id = c.produto_id
       where ($1::uuid is null or c.loja_id = $1)
       group by c.loja_id, lo.nome, c.produto_id, p.sku, p.descricao, p.codigo_barras,
                e.produto_id, e.saldo, e.saidas, e.valor_custo, e.valor_venda
       order by max(c.criado_em) desc`,
      [lojaDaConsulta(req)],
    )
    return rows
  })
  res.json(linhas)
}))

const corpoNovaContagem = z.object({
  produtoId: z.string().uuid(),
  // Zero vale: "olhei e não havia nada".
  quantidade: z.number().int().min(0).max(1_000_000),
})

/**
 * Soma um registro à contagem do produto. Devolve o novo total, para a tela
 * dizer "agora são 15" sem precisar reler a lista.
 *
 * O administrador pode contar em nome de outra loja (`?loja=<id>`), como ao
 * registrar uma quebra; `criado_por_id` continua sendo ele.
 */
rotasAuditoria.post('/', assincrono(async (req, res) => {
  const corpo = corpoNovaContagem.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe o produto e uma quantidade de 0 em diante.' })
    return
  }

  const loja = lojaDaEscrita(req, res)
  if (!loja) return

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    // O `select` em `produtos` passa pela RLS: um id de outra conta não aparece, e
    // nada é gravado.
    const { rowCount } = await client.query(
      `insert into contagens (loja_id, produto_id, quantidade, criado_por_id)
       select $1, p.id, $3, $4 from produtos p where p.id = $2`,
      [loja, corpo.data.produtoId, corpo.data.quantidade, req.loginId],
    )
    if (!rowCount) return null

    const { rows } = await client.query(
      'select sum(quantidade)::int as contagem from contagens where loja_id = $1 and produto_id = $2',
      [loja, corpo.data.produtoId],
    )
    return rows[0] as { contagem: number }
  })

  if (!resultado) {
    res.status(404).json({ erro: 'Produto não encontrado.' })
    return
  }
  res.status(201).json(resultado)
}))

const parametroId = z.object({ id: z.string().uuid() })

/** Remove UMA parcela (um registro digitado errado), sem mexer nas outras. */
rotasAuditoria.delete('/parcelas/:id', assincrono(async (req, res) => {
  const parametros = parametroId.safeParse(req.params)
  if (!parametros.success) {
    res.status(400).json({ erro: 'Registro inválido.' })
    return
  }

  const removidas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rowCount } = await client.query('delete from contagens where id = $1', [parametros.data.id])
    return rowCount ?? 0
  })

  if (removidas === 0) {
    res.status(404).json({ erro: 'Registro não encontrado.' })
    return
  }
  res.status(204).end()
}))

/**
 * Zera a auditoria de UMA loja (a do login, ou, com `?loja=`, a que o
 * administrador escolheu): é como se começa uma nova contagem. Nunca age sobre a
 * conta inteira de uma vez, para ninguém apagar a loja errada.
 */
rotasAuditoria.delete('/', assincrono(async (req, res) => {
  const loja = lojaDaEscrita(req, res)
  if (!loja) return

  const removidas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rowCount } = await client.query('delete from contagens where loja_id = $1', [loja])
    return rowCount ?? 0
  })
  res.json({ removidas })
}))
