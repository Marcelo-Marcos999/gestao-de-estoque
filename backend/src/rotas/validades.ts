import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'

export const rotasValidades = Router()

rotasValidades.use(exigirAutenticacao)

/**
 * Lotes (produto + data de validade) da loja de quem está logado.
 *
 * Um lote só guarda a data: descrição, saldo e valores são lidos do produto e
 * do estoque na hora, nunca copiados (ver docs/modelo-de-dados.md). Por isso
 * esta rota devolve o mínimo — quem monta a linha da tela é o front-end.
 *
 * Como em `/estoque`, a loja é sempre a do próprio login (`req.loginId`).
 */

/**
 * `to_char` em vez de devolver a coluna `date` direto: o driver do Postgres
 * converte `date` num `Date` do JavaScript à meia-noite do fuso do servidor, e
 * o dia pode virar o anterior ao chegar no navegador. Texto `AAAA-MM-DD` não
 * sofre isso.
 */
const COLUNAS_DO_LOTE = `v.id, e.produto_id, to_char(v.data_validade, 'YYYY-MM-DD') as data_validade, v.criado_em`

const dataValidade = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

rotasValidades.get('/', assincrono(async (req, res) => {
  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select ${COLUNAS_DO_LOTE}
       from validades v
       join estoque e on e.id = v.estoque_id
       where e.loja_id = $1
       order by v.criado_em desc`,
      [req.loginId],
    )
    return rows
  })
  res.json(linhas)
}))

const corpoNovoLote = z.object({
  produtoId: z.string().uuid(),
  dataValidade,
})

/**
 * Garante que exista um lote deste produto nesta validade. Devolve `criado:
 * false` quando já existia, pra tela poder dizer "esse lote já estava na
 * lista" em vez de parecer que salvar não fez nada.
 *
 * Lançar um lote de um produto que a loja nunca lançou no estoque cria a
 * posição zerada (saldo 0): o lote precisa de uma linha em `estoque` pra
 * existir (é de lá que ele sai), e o saldo de verdade vem depois, da
 * importação ou da tela de Estoque.
 */
rotasValidades.post('/', assincrono(async (req, res) => {
  const corpo = corpoNovoLote.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe o produto e a data de validade.' })
    return
  }

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    // O `select` em `produtos` passa pela RLS: um id de produto de outra
    // conta simplesmente não aparece, e o lote não é criado.
    await client.query(
      `insert into estoque (loja_id, produto_id)
       select $1, p.id from produtos p where p.id = $2
       on conflict (loja_id, produto_id) do nothing`,
      [req.loginId, corpo.data.produtoId],
    )
    const { rows: posicao } = await client.query(
      'select id from estoque where loja_id = $1 and produto_id = $2',
      [req.loginId, corpo.data.produtoId],
    )
    if (posicao.length === 0) return null

    // Não há índice único em (estoque_id, data_validade) porque uma data nula
    // pode se repetir. A trava segura dois cliques simultâneos no mesmo lote
    // até o fim da transação; sem ela, os dois passariam pelo "já existe?".
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [posicao[0].id])

    const { rows: existente } = await client.query(
      'select id from validades where estoque_id = $1 and data_validade = $2',
      [posicao[0].id, corpo.data.dataValidade],
    )
    if (existente.length > 0) return { id: existente[0].id as string, criado: false }

    const { rows } = await client.query(
      'insert into validades (estoque_id, data_validade) values ($1, $2) returning id',
      [posicao[0].id, corpo.data.dataValidade],
    )
    return { id: rows[0].id as string, criado: true }
  })

  if (!resultado) {
    res.status(404).json({ erro: 'Produto não encontrado.' })
    return
  }
  res.status(resultado.criado ? 201 : 200).json(resultado)
}))

const corpoAtualizarLote = z.object({ dataValidade: dataValidade.nullable() })

/** A data é o único campo que se corrige: saldo e saídas são do produto. */
rotasValidades.patch('/:id', assincrono(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  const corpo = corpoAtualizarLote.safeParse(req.body)
  if (!id.success || !corpo.success) {
    res.status(400).json({ erro: 'Data de validade inválida.' })
    return
  }

  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      'update validades set data_validade = $2 where id = $1 returning id',
      [id.data, corpo.data.dataValidade],
    )
    return rows
  })

  if (linhas.length === 0) {
    res.status(404).json({ erro: 'Lote não encontrado.' })
    return
  }
  res.json(linhas[0])
}))

const corpoExcluir = z.object({ ids: z.array(z.string().uuid()).min(1).max(5000) })

/** Devolve o que saiu de verdade, inteiro, pra tela poder oferecer o "desfazer". */
rotasValidades.delete('/', assincrono(async (req, res) => {
  const corpo = corpoExcluir.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe os lotes a excluir.' })
    return
  }

  const removidos = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `with excluidos as (
         delete from validades where id = any($1::uuid[])
         returning id, estoque_id, data_validade, criado_em
       )
       select x.id, e.produto_id, to_char(x.data_validade, 'YYYY-MM-DD') as data_validade, x.criado_em
       from excluidos x join estoque e on e.id = x.estoque_id`,
      [corpo.data.ids],
    )
    return rows
  })
  res.json(removidos)
}))

const corpoRestaurar = z.object({
  lotes: z
    .array(
      z.object({
        id: z.string().uuid(),
        produtoId: z.string().uuid(),
        dataValidade: dataValidade.nullable(),
        criadoEm: z.string(),
      }),
    )
    .min(1)
    .max(5000),
})

/** O "desfazer" da exclusão: devolve os lotes com o mesmo id e a mesma data de criação. */
rotasValidades.post('/restaurar', assincrono(async (req, res) => {
  const corpo = corpoRestaurar.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Lotes inválidos.' })
    return
  }
  const { lotes } = corpo.data

  await comContextoDoUsuario(req.sessao!, async (client) => {
    await client.query(
      `insert into validades (id, estoque_id, data_validade, criado_em)
       select l.id, e.id, l.data_validade, l.criado_em::timestamptz
       from unnest($2::uuid[], $3::uuid[], $4::date[], $5::text[])
            as l(id, produto_id, data_validade, criado_em)
       join estoque e on e.produto_id = l.produto_id and e.loja_id = $1
       on conflict (id) do nothing`,
      [
        req.loginId,
        lotes.map((l) => l.id),
        lotes.map((l) => l.produtoId),
        lotes.map((l) => l.dataValidade),
        lotes.map((l) => l.criadoEm),
      ],
    )
  })
  res.status(204).end()
}))

const corpoLote = z.object({
  itens: z
    .array(z.object({ produtoId: z.string().uuid(), dataValidade }))
    .min(1)
    .max(1000),
})

/**
 * Cria vários lotes de uma vez (importação de planilha), ignorando os que já
 * existem. Mesmas regras de `POST /`, sem uma ida ao banco por linha: com
 * milhares de lotes, 150 ms cada (Render → Neon) viraria minutos.
 *
 * Devolve só os números. Produto que não é da conta simplesmente não aparece
 * (a RLS esconde) e cai em `ignorados`, como o lote que já existia.
 */
rotasValidades.post('/lote', assincrono(async (req, res) => {
  const corpo = corpoLote.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Lotes inválidos.' })
    return
  }
  const { itens } = corpo.data
  const produtos = itens.map((i) => i.produtoId)
  const datas = itens.map((i) => i.dataValidade)

  const criados = await comContextoDoUsuario(req.sessao!, async (client) => {
    // Mesma trava de `POST /`, por loja: dois envios simultâneos do mesmo lote
    // passariam juntos pelo "ainda não existe".
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`validades:${req.loginId}`])

    // Um lote precisa de uma posição de estoque; produto sem uma ganha a posição zerada.
    await client.query(
      `insert into estoque (loja_id, produto_id)
       select $1, p.id from produtos p where p.id = any($2::uuid[])
       on conflict (loja_id, produto_id) do nothing`,
      [req.loginId, produtos],
    )

    const { rowCount } = await client.query(
      `insert into validades (estoque_id, data_validade)
       select e.id, i.data_validade
       from (select distinct produto_id, data_validade
             from unnest($2::uuid[], $3::date[]) as t(produto_id, data_validade)) i
       join estoque e on e.produto_id = i.produto_id and e.loja_id = $1
       where not exists (
         select 1 from validades v where v.estoque_id = e.id and v.data_validade = i.data_validade
       )`,
      [req.loginId, produtos, datas],
    )
    return rowCount ?? 0
  })

  const distintos = new Set(itens.map((i) => `${i.produtoId}|${i.dataValidade}`)).size
  res.json({ criados, ignorados: distintos - criados })
}))
