import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAdmin, exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'

export const rotasEstoque = Router()

rotasEstoque.use(exigirAutenticacao)

/**
 * O saldo de "qual loja" é sempre o do próprio login — `req.loginId`, não
 * `req.sessao.lojaId` (que vem nulo pro admin, porque admin não fica preso a
 * uma loja só nas regras de permissão). Aqui o login age como a loja que ele
 * é, admin ou não: cada um só tem UMA posição de estoque, que é a sua.
 *
 * Isto é o jeito mais simples de atender o app de hoje (uma tela de Estoque
 * só, sem seletor de loja). O dia em que o admin precisar ver o estoque de
 * OUTRAS lojas da conta num painel próprio, essa rota ganha um parâmetro
 * `lojaId` opcional — a RLS (estoque_all) já permite isso pro admin, só o
 * código da rota ainda não pede.
 */
rotasEstoque.get('/', assincrono(async (req, res) => {
  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select p.id as produto_id, p.sku, p.descricao, p.codigo_barras, p.pendente_cadastro,
              p.criado_em, p.atualizado_em,
              e.saldo, e.saidas, e.valor_custo, e.valor_venda
       from estoque e
       join produtos p on p.id = e.produto_id
       where e.loja_id = $1
       order by p.descricao`,
      [req.loginId],
    )
    return rows
  })
  res.json(linhas)
}))

// saldo/saidas aceitam número com casas decimais na entrada (um campo de
// formulário não impede isso) e são arredondados logo abaixo, antes de
// chegar na coluna inteira — a mesma tolerância que `Math.round` já dava
// quando isso vivia em memória, em vez de rejeitar a tela inteira por causa
// de um "12.0" digitado sem querer.
const corpoAtualizarEstoque = z.object({
  saldo: z.number().min(0).optional(),
  saidas: z.number().min(0).optional(),
  valorCusto: z.number().min(0).optional(),
  valorVenda: z.number().min(0).optional(),
})

/** undefined some arredondado, não vira 0 — isso continua significando "não mexer neste campo". */
function arredondarSeDefinido(valor: number | undefined): number | undefined {
  return valor === undefined ? undefined : Math.round(valor)
}

/**
 * Corrige um ou mais dos quatro números. Qualquer subconjunto: quem chama
 * manda só o que tem em mãos, e o `coalesce` contra o valor que já está na
 * linha preserva o resto — mesma regra que `updateProductStock` já seguia
 * em memória (ver features/products/api.ts do front).
 *
 * `insert ... on conflict` em vez de um `update` puro: um produto cadastrado
 * à mão (POST /produtos) ainda não tem linha em `estoque` pra nenhuma loja —
 * um UPDATE simples não acharia nada pra atualizar e devolveria 404 pra um
 * caso que não é erro nenhum, só "esta loja nunca lançou número pra esse
 * produto ainda".
 */
rotasEstoque.patch('/:produtoId', assincrono(async (req, res) => {
  const corpo = corpoAtualizarEstoque.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Valores de estoque inválidos.' })
    return
  }

  const linha = await comContextoDoUsuario(req.sessao!, async (client) => {
    // O `::numeric` em valor_custo/valor_venda não é sobre converter o
    // valor — é pra impedir que o Postgres chute o tipo do parâmetro a
    // partir do literal `0` ao lado dele dentro do `coalesce` (um `0` sem
    // ponto decimal é inteiro por padrão). Sem o cast, mandar um custo como
    // 12.50 pra cá derrubava a conexão inteira com "invalid input syntax
    // for type integer", porque o Postgres decidia que o parâmetro também
    // devia ser inteiro.
    const { rows } = await client.query(
      `insert into estoque (loja_id, produto_id, saldo, saidas, valor_custo, valor_venda)
       values (
         $1, $2,
         coalesce($3, 0), coalesce($4, 0),
         coalesce($5::numeric, 0), coalesce($6::numeric, 0)
       )
       on conflict (loja_id, produto_id) do update
         set saldo = coalesce($3, estoque.saldo),
             saidas = coalesce($4, estoque.saidas),
             valor_custo = coalesce($5::numeric, estoque.valor_custo),
             valor_venda = coalesce($6::numeric, estoque.valor_venda)
       returning produto_id, saldo, saidas, valor_custo, valor_venda`,
      [
        req.loginId,
        req.params.produtoId,
        arredondarSeDefinido(corpo.data.saldo),
        arredondarSeDefinido(corpo.data.saidas),
        corpo.data.valorCusto,
        corpo.data.valorVenda,
      ],
    )
    return rows[0]
  })

  res.json(linha)
}))

const corpoNovaLinha = z.object({
  sku: z.string().trim().min(1),
  descricao: z.string().trim().min(1).optional(),
  codigoBarras: z.string().trim().optional(),
  saldo: z.number().min(0).default(0),
  saidas: z.number().min(0).default(0),
  valorCusto: z.number().min(0).default(0),
  valorVenda: z.number().min(0).default(0),
})

/**
 * Adiciona uma linha à mão, pelo SKU.
 *
 * SKU que o catálogo da conta já conhece: só grava os quatro números para
 * esta loja. SKU desconhecido: cria o produto como pendente_cadastro (ver
 * CLAUDE.md, "Perfis de acesso") com loja_origem_id apontando pra quem
 * disparou isso — é o mesmo caminho que a importação do relatório de
 * estoque usa, só que com uma linha em vez de milhares (essa, em lote,
 * ainda não tem rota própria).
 */
rotasEstoque.post('/', assincrono(async (req, res) => {
  const corpo = corpoNovaLinha.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Dados da linha de estoque inválidos.' })
    return
  }

  const linha = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows: existentes } = await client.query<{ id: string }>(
      'select id from produtos where sku = $1',
      [corpo.data.sku],
    )

    const produtoId =
      existentes[0]?.id ??
      (
        await client.query<{ id: string }>(
          `insert into produtos (conta_id, sku, descricao, codigo_barras, pendente_cadastro, loja_origem_id)
           values ($1, $2, $3, $4, true, $5)
           returning id`,
          [
            req.sessao!.contaId,
            corpo.data.sku,
            corpo.data.descricao ?? '',
            corpo.data.codigoBarras ?? null,
            req.loginId,
          ],
        )
      ).rows[0]!.id

    const { rows } = await client.query(
      `insert into estoque (loja_id, produto_id, saldo, saidas, valor_custo, valor_venda)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (loja_id, produto_id) do update
         set saldo = excluded.saldo,
             saidas = excluded.saidas,
             valor_custo = excluded.valor_custo,
             valor_venda = excluded.valor_venda
       returning produto_id, saldo, saidas, valor_custo, valor_venda`,
      [
        req.loginId,
        produtoId,
        Math.round(corpo.data.saldo),
        Math.round(corpo.data.saidas),
        corpo.data.valorCusto,
        corpo.data.valorVenda,
      ],
    )
    return rows[0]
  })

  res.status(201).json(linha)
}))

const corpoImportarEstoque = z.object({
  linhas: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        saldo: z.number().min(0).optional(),
        saidas: z.number().min(0).optional(),
        valorCusto: z.number().min(0).optional(),
        valorVenda: z.number().min(0).optional(),
      }),
    )
    .min(1)
    .max(5000),
})

/**
 * Importação em lote da planilha de estoque — mesma regra do `POST /`
 * acima (SKU desconhecido cria produto pendente), só que pra muitas linhas
 * de uma vez.
 *
 * Três comandos SQL por lote, não três por linha: cada ida ao banco custa
 * ~150 ms entre o Render (EUA) e o Neon (São Paulo), então um laço linha a
 * linha levava mais de uma hora numa planilha de 25 mil produtos e cada
 * requisição estourava o tempo limite do Render.
 *   1. cria como pendentes os SKUs que o catálogo ainda não conhece;
 *   2. atualiza as posições de estoque que já existem (só os campos
 *      enviados — `coalesce` preserva o resto);
 *   3. cria as posições que faltam, com zero nos campos não enviados.
 */
rotasEstoque.post('/importar', assincrono(async (req, res) => {
  const corpo = corpoImportarEstoque.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Linhas de importação inválidas.' })
    return
  }

  const { linhas } = corpo.data
  // null (e não undefined) é o que vira NULL dentro do array do Postgres.
  const skus = linhas.map((l) => l.sku)
  const saldos = linhas.map((l) => arredondarSeDefinido(l.saldo) ?? null)
  const saidas = linhas.map((l) => arredondarSeDefinido(l.saidas) ?? null)
  const custos = linhas.map((l) => l.valorCusto ?? null)
  const vendas = linhas.map((l) => l.valorVenda ?? null)

  // Os casts `::integer[]`/`::numeric[]` pelo mesmo motivo do PATCH acima:
  // sem eles o Postgres chuta o tipo dos parâmetros e rejeita centavos.
  const valores = `unnest($2::text[], $3::integer[], $4::integer[], $5::numeric[], $6::numeric[])
                   as x(sku, saldo, saidas, valor_custo, valor_venda)`

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rowCount: pendentesCriados } = await client.query(
      `insert into produtos (conta_id, sku, pendente_cadastro, loja_origem_id)
       select $1, s.sku, true, $2
       from (select distinct sku from unnest($3::text[]) as sku) s
       where not exists (select 1 from produtos p where p.sku = s.sku)
       on conflict (conta_id, sku) do nothing`,
      [req.sessao!.contaId, req.loginId, skus],
    )

    await client.query(
      `update estoque e
       set saldo = coalesce(x.saldo, e.saldo),
           saidas = coalesce(x.saidas, e.saidas),
           valor_custo = coalesce(x.valor_custo, e.valor_custo),
           valor_venda = coalesce(x.valor_venda, e.valor_venda)
       from ${valores}
       join produtos p on p.sku = x.sku
       where e.produto_id = p.id and e.loja_id = $1`,
      [req.loginId, skus, saldos, saidas, custos, vendas],
    )

    await client.query(
      `insert into estoque (loja_id, produto_id, saldo, saidas, valor_custo, valor_venda)
       select $1, p.id,
              coalesce(x.saldo, 0), coalesce(x.saidas, 0),
              coalesce(x.valor_custo, 0), coalesce(x.valor_venda, 0)
       from ${valores}
       join produtos p on p.sku = x.sku
       on conflict (loja_id, produto_id) do nothing`,
      [req.loginId, skus, saldos, saidas, custos, vendas],
    )

    const criados = pendentesCriados ?? 0
    return { updated: linhas.length - criados, pendingCreated: criados }
  })

  res.json(resultado)
}))

/**
 * Quanto existe para apagar: as posições de estoque e os lotes de validade que
 * dependem delas. A tela mostra isto antes de pedir a confirmação — "apagar
 * tudo" sem dizer o tamanho do estrago não é uma confirmação de verdade.
 */
rotasEstoque.get('/contagem', exigirAdmin, assincrono(async (req, res) => {
  const linha = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select (select count(*) from estoque where loja_id = $1)::int as linhas,
              (select count(*) from validades v join estoque e on e.id = v.estoque_id
                where e.loja_id = $1)::int as lotes`,
      [req.loginId],
    )
    return rows[0]
  })
  res.json(linha)
}))

/**
 * Apaga TODAS as posições de estoque da loja — para quem vai reimportar a base
 * do zero. Os produtos continuam no cadastro: só saldo, saídas, custo e venda
 * saem.
 *
 * Os lotes de validade saem junto: um lote só existe como filho de uma posição
 * de estoque (`on delete cascade`), e mantê-lo sem ela deixaria uma validade sem
 * produto na loja. Quebras não são tocadas: guardam o produto, não a posição.
 *
 * Só o administrador: é a ação mais destrutiva da tela e não tem desfazer.
 */
rotasEstoque.delete('/', exigirAdmin, assincrono(async (req, res) => {
  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows: lotes } = await client.query(
      `select count(*)::int as n from validades v join estoque e on e.id = v.estoque_id
        where e.loja_id = $1`,
      [req.loginId],
    )
    const { rowCount } = await client.query('delete from estoque where loja_id = $1', [req.loginId])
    return { linhas: rowCount ?? 0, lotes: lotes[0].n as number }
  })
  res.json(resultado)
}))

const corpoLinhas = z.object({ produtoIds: z.array(z.string().uuid()).min(1).max(5000) })

/** O que sairia se estas posições fossem apagadas: a tela mostra antes de confirmar. */
rotasEstoque.post('/linhas/contagem', exigirAdmin, assincrono(async (req, res) => {
  const corpo = corpoLinhas.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe os produtos.' })
    return
  }

  const linha = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select (select count(*) from estoque where loja_id = $1 and produto_id = any($2::uuid[]))::int as linhas,
              (select count(*) from validades v join estoque e on e.id = v.estoque_id
                where e.loja_id = $1 and e.produto_id = any($2::uuid[]))::int as lotes`,
      [req.loginId, corpo.data.produtoIds],
    )
    return rows[0]
  })
  res.json(linha)
}))

/**
 * Apaga a posição de estoque de alguns produtos (os selecionados na tela). Mesma
 * regra do "excluir tudo": os lotes de validade desses produtos saem junto, e os
 * produtos e as quebras ficam. Só o administrador.
 */
rotasEstoque.delete('/linhas', exigirAdmin, assincrono(async (req, res) => {
  const corpo = corpoLinhas.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe os produtos.' })
    return
  }

  const resultado = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows: lotes } = await client.query(
      `select count(*)::int as n from validades v join estoque e on e.id = v.estoque_id
        where e.loja_id = $1 and e.produto_id = any($2::uuid[])`,
      [req.loginId, corpo.data.produtoIds],
    )
    const { rowCount } = await client.query(
      'delete from estoque where loja_id = $1 and produto_id = any($2::uuid[])',
      [req.loginId, corpo.data.produtoIds],
    )
    return { linhas: rowCount ?? 0, lotes: lotes[0].n as number }
  })
  res.json(resultado)
}))
