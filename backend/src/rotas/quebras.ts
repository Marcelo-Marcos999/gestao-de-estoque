import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'

export const rotasQuebras = Router()

rotasQuebras.use(exigirAutenticacao)

/**
 * Registros de quebra da loja de quem está logado (`req.loginId`, como em
 * `/estoque` e `/validades`).
 *
 * Produto cadastrado: descrição, SKU e código de barras saem do catálogo na
 * hora de ler — corrigir o cadastro corrige a quebra. Produto pendente (o
 * operador apontou algo que ainda não existe no cadastro): vale o que ele
 * digitou, que fica na própria quebra.
 */

/** Falha de validação detectada DENTRO da transação: lançar faz o ROLLBACK desfazer o que já entrou. */
class EntradaInvalida extends Error {}

const COLUNAS = `q.id, q.produto_id,
                 coalesce(p.sku, q.sku, '') as sku,
                 coalesce(p.descricao, q.descricao, '') as descricao,
                 coalesce(p.codigo_barras, q.codigo_barras, '') as codigo_barras,
                 q.pendente_produto,
                 to_char(q.data_validade, 'YYYY-MM-DD') as data_validade,
                 q.quantidade, q.motivo_id, q.origem_id,
                 coalesce(q.observacao, '') as observacao,
                 q.criado_em, q.criado_por_id, l.nome as criado_por`

const DESDE = `from quebras q
               left join produtos p on p.id = q.produto_id
               join lojas l on l.id = q.criado_por_id`

rotasQuebras.get('/', assincrono(async (req, res) => {
  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select ${COLUNAS} ${DESDE} where q.loja_id = $1 order by q.criado_em desc`,
      [req.loginId],
    )
    return rows
  })
  res.json(linhas)
}))

const dataValidade = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const itemQuebra = z.object({
  produtoId: z.string().uuid().nullable(),
  sku: z.string().trim().max(60).default(''),
  descricao: z.string().trim().max(300).default(''),
  codigoBarras: z.string().trim().max(60).default(''),
  pendente: z.boolean().default(false),
  dataValidade: dataValidade.nullable(),
  quantidade: z.number().int().min(0).max(1_000_000),
  observacao: z.string().trim().max(2000).default(''),
})

const corpoCriar = z.object({
  motivoId: z.string().uuid(),
  origemId: z.string().uuid(),
  itens: z.array(itemQuebra).min(1).max(1000),
})

/**
 * Cria um ou vários registros, todos com o mesmo motivo e a mesma origem.
 *
 * Um comando só pra todos, em vez de um por registro: o envio em massa de
 * lotes vencidos manda centenas, e cada ida ao banco custa ~150 ms daqui
 * (Render, EUA) até lá (Neon, São Paulo).
 *
 * Motivo, origem e produto entram por `join`, que passa pela RLS: um id de
 * outra conta não aparece, o registro não é criado e a transação inteira é
 * desfeita — nunca sobra metade do lote gravado.
 */
rotasQuebras.post('/', assincrono(async (req, res) => {
  const corpo = corpoCriar.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Dados do registro inválidos. Confira motivo, origem e quantidade.' })
    return
  }
  const { motivoId, origemId, itens } = corpo.data

  try {
    const ids = await comContextoDoUsuario(req.sessao!, async (client) => {
      const { rows } = await client.query(
        `insert into quebras (loja_id, produto_id, sku, descricao, codigo_barras, pendente_produto,
                              data_validade, quantidade, motivo_id, origem_id, observacao, criado_por_id)
         select $1, p.id, nullif(i.sku, ''), nullif(i.descricao, ''), nullif(i.codigo_barras, ''),
                i.pendente, i.data_validade, i.quantidade, m.id, o.id, nullif(i.observacao, ''), $1
         from unnest($4::uuid[], $5::text[], $6::text[], $7::text[], $8::boolean[],
                     $9::date[], $10::int[], $11::text[])
              as i(produto_id, sku, descricao, codigo_barras, pendente, data_validade, quantidade, observacao)
         join motivos m on m.id = $2
         join origens o on o.id = $3
         left join produtos p on p.id = i.produto_id
         where i.produto_id is null or p.id is not null
         returning id`,
        [
          req.loginId, motivoId, origemId,
          itens.map((i) => i.produtoId),
          itens.map((i) => i.sku),
          itens.map((i) => i.descricao),
          itens.map((i) => i.codigoBarras),
          itens.map((i) => i.pendente),
          itens.map((i) => i.dataValidade),
          itens.map((i) => i.quantidade),
          itens.map((i) => i.observacao),
        ],
      )
      if (rows.length !== itens.length) throw new EntradaInvalida()
      return rows.map((r) => r.id as string)
    })
    res.status(201).json({ ids })
  } catch (erro) {
    if (erro instanceof EntradaInvalida) {
      res.status(400).json({ erro: 'Motivo, origem ou produto não encontrado.' })
      return
    }
    throw erro
  }
}))

const corpoAtualizar = itemQuebra.extend({
  motivoId: z.string().uuid(),
  origemId: z.string().uuid(),
})

rotasQuebras.patch('/:id', assincrono(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  const corpo = corpoAtualizar.safeParse(req.body)
  if (!id.success || !corpo.success) {
    res.status(400).json({ erro: 'Dados do registro inválidos. Confira motivo, origem e quantidade.' })
    return
  }
  const d = corpo.data

  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `update quebras q
          set produto_id = p.id, sku = nullif($3, ''), descricao = nullif($4, ''),
              codigo_barras = nullif($5, ''), pendente_produto = $6, data_validade = $7,
              quantidade = $8, motivo_id = m.id, origem_id = o.id, observacao = nullif($11, '')
         from motivos m, origens o
         left join produtos p on p.id = $2::uuid
        where q.id = $1 and m.id = $9 and o.id = $10
          and ($2::uuid is null or p.id is not null)
       returning q.id`,
      [id.data, d.produtoId, d.sku, d.descricao, d.codigoBarras, d.pendente, d.dataValidade,
       d.quantidade, d.motivoId, d.origemId, d.observacao],
    )
    return rows
  })

  if (linhas.length === 0) {
    res.status(404).json({ erro: 'Registro, motivo, origem ou produto não encontrado.' })
    return
  }
  res.json(linhas[0])
}))

/** "Somar ao registro que já existe", do aviso de duplicidade. Soma no banco: ler, somar e gravar perderia um clique simultâneo. */
rotasQuebras.post('/:id/somar', assincrono(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  const corpo = z.object({ quantidade: z.number().int().min(1).max(1_000_000) }).safeParse(req.body)
  if (!id.success || !corpo.success) {
    res.status(400).json({ erro: 'Quantidade inválida.' })
    return
  }

  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      'update quebras set quantidade = quantidade + $2 where id = $1 returning id',
      [id.data, corpo.data.quantidade],
    )
    return rows
  })

  if (linhas.length === 0) {
    res.status(404).json({ erro: 'Registro não encontrado.' })
    return
  }
  res.status(204).end()
}))

const corpoExcluir = z.object({ ids: z.array(z.string().uuid()).min(1).max(5000) })

/** Devolve os registros inteiros, no mesmo formato da lista, pra tela oferecer o "desfazer". */
rotasQuebras.delete('/', assincrono(async (req, res) => {
  const corpo = corpoExcluir.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe os registros a excluir.' })
    return
  }

  const removidos = await comContextoDoUsuario(req.sessao!, async (client) => {
    // Lê antes de apagar: depois do DELETE o produto e o autor ainda existem,
    // mas assim a leitura é a mesma da lista, sem montar o formato duas vezes.
    const { rows } = await client.query(
      `select ${COLUNAS} ${DESDE} where q.loja_id = $1 and q.id = any($2::uuid[])`,
      [req.loginId, corpo.data.ids],
    )
    await client.query('delete from quebras where loja_id = $1 and id = any($2::uuid[])', [
      req.loginId,
      corpo.data.ids,
    ])
    return rows
  })
  res.json(removidos)
}))

const corpoRestaurar = z.object({
  registros: z
    .array(
      itemQuebra.extend({
        id: z.string().uuid(),
        motivoId: z.string().uuid(),
        origemId: z.string().uuid(),
        criadoPorId: z.string().uuid(),
        criadoEm: z.string(),
      }),
    )
    .min(1)
    .max(5000),
})

/** O "desfazer" da exclusão: mesmo id, mesma data e o mesmo autor de antes. */
rotasQuebras.post('/restaurar', assincrono(async (req, res) => {
  const corpo = corpoRestaurar.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Registros inválidos.' })
    return
  }
  const r = corpo.data.registros

  await comContextoDoUsuario(req.sessao!, async (client) => {
    await client.query(
      `insert into quebras (id, loja_id, produto_id, sku, descricao, codigo_barras, pendente_produto,
                            data_validade, quantidade, motivo_id, origem_id, observacao,
                            criado_por_id, criado_em)
       select i.id, $1, p.id, nullif(i.sku, ''), nullif(i.descricao, ''), nullif(i.codigo_barras, ''),
              i.pendente, i.data_validade, i.quantidade, m.id, o.id, nullif(i.observacao, ''),
              l.id, i.criado_em::timestamptz
       from unnest($2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[], $7::boolean[],
                   $8::date[], $9::int[], $10::uuid[], $11::uuid[], $12::text[], $13::uuid[], $14::text[])
            as i(id, produto_id, sku, descricao, codigo_barras, pendente, data_validade, quantidade,
                 motivo_id, origem_id, observacao, criado_por_id, criado_em)
       join motivos m on m.id = i.motivo_id
       join origens o on o.id = i.origem_id
       join lojas l on l.id = i.criado_por_id
       left join produtos p on p.id = i.produto_id
       where i.produto_id is null or p.id is not null
       on conflict (id) do nothing`,
      [
        req.loginId,
        r.map((x) => x.id),
        r.map((x) => x.produtoId),
        r.map((x) => x.sku),
        r.map((x) => x.descricao),
        r.map((x) => x.codigoBarras),
        r.map((x) => x.pendente),
        r.map((x) => x.dataValidade),
        r.map((x) => x.quantidade),
        r.map((x) => x.motivoId),
        r.map((x) => x.origemId),
        r.map((x) => x.observacao),
        r.map((x) => x.criadoPorId),
        r.map((x) => x.criadoEm),
      ],
    )
  })
  res.status(204).end()
}))
