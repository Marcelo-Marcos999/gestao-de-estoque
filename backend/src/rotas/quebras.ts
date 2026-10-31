import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'
import { lojaDaConsulta } from '../lib/lojas.js'

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
                 q.criado_em, q.criado_por_id, l.nome as criado_por,
                 q.loja_id, lo.nome as loja_nome, e.saldo, e.valor_custo,
                 (select coalesce(json_agg(json_build_object(
                           'id', a.id, 'tipo', a.tipo, 'nome', a.nome_arquivo,
                           'mime', a.mime_type, 'tamanho', a.tamanho_bytes) order by a.criado_em), '[]'::json)
                    from anexos a where a.quebra_id = q.id) as anexos`

/**
 * `e`: o estoque DA LOJA DO REGISTRO. O saldo limita a quantidade e o custo
 * dá o total da perda; quando o administrador vê as lojas todas, usar o estoque
 * do próprio login trocaria os números de uma loja pelos de outra.
 */
const DESDE = `from quebras q
               left join produtos p on p.id = q.produto_id
               join lojas l on l.id = q.criado_por_id
               join lojas lo on lo.id = q.loja_id
               left join estoque e on e.loja_id = q.loja_id and e.produto_id = q.produto_id`

/**
 * Filtro "o mesmo produto": quem registra uma quebra quer saber, antes de salvar,
 * se já existe outra do mesmo item. O produto pode ser achado por id, SKU ou
 * código de barras — um registro de produto ainda PENDENTE não tem id no
 * cadastro, só o SKU/código que a pessoa digitou, e por isso o casamento é
 * pelos três e basta um. Sem nenhum dos três, a lista vem inteira.
 */
const filtroDoProduto = z.object({
  produto: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(60).optional(),
  barras: z.string().trim().min(1).max(60).optional(),
})

rotasQuebras.get('/', assincrono(async (req, res) => {
  const filtro = filtroDoProduto.safeParse(req.query)
  if (!filtro.success) {
    res.status(400).json({ erro: 'Filtro de produto inválido.' })
    return
  }

  const parametros: unknown[] = [lojaDaConsulta(req)]
  const alternativas: string[] = []
  const { produto, sku, barras } = filtro.data
  if (produto) alternativas.push(`q.produto_id = $${parametros.push(produto)}`)
  if (sku) alternativas.push(`coalesce(p.sku, q.sku) = $${parametros.push(sku)}`)
  if (barras) alternativas.push(`coalesce(p.codigo_barras, q.codigo_barras) = $${parametros.push(barras)}`)

  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select ${COLUNAS} ${DESDE}
       where ($1::uuid is null or q.loja_id = $1)
       ${alternativas.length > 0 ? `and (${alternativas.join(' or ')})` : ''}
       order by q.criado_em desc`,
      parametros,
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

const corpoCriar = z
  .object({
    /** Valem para os itens que não trazem o próprio (envio em massa: um só para todos). */
    motivoId: z.string().uuid().optional(),
    origemId: z.string().uuid().optional(),
    /** Só o administrador: registrar a perda em NOME de outra loja (`criado_por` continua sendo ele). */
    lojaId: z.string().uuid().optional(),
    // Importação de planilha: cada linha traz o seu motivo e a sua origem.
    itens: z
      .array(
        itemQuebra.extend({
          motivoId: z.string().uuid().optional(),
          origemId: z.string().uuid().optional(),
        }),
      )
      .min(1)
      .max(1000),
  })
  // Motivo e origem são obrigatórios: o item traz o seu ou herda o do pedido.
  .refine((c) => c.itens.every((i) => (i.motivoId ?? c.motivoId) && (i.origemId ?? c.origemId)))

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
  const { itens } = corpo.data
  const loja = corpo.data.lojaId ?? req.loginId!
  if (loja !== req.loginId && req.sessao?.role !== 'admin') {
    res.status(403).json({ erro: 'Só o administrador pode registrar a quebra de outra loja.' })
    return
  }

  try {
    const ids = await comContextoDoUsuario(req.sessao!, async (client) => {
      const { rows } = await client.query(
        `insert into quebras (loja_id, produto_id, sku, descricao, codigo_barras, pendente_produto,
                              data_validade, quantidade, motivo_id, origem_id, observacao, criado_por_id)
         select $14::uuid, p.id, nullif(i.sku, ''), nullif(i.descricao, ''), nullif(i.codigo_barras, ''),
                i.pendente, i.data_validade, i.quantidade, m.id, o.id, nullif(i.observacao, ''), $1
         from unnest($4::uuid[], $5::text[], $6::text[], $7::text[], $8::boolean[],
                     $9::date[], $10::int[], $11::text[], $12::uuid[], $13::uuid[])
              as i(produto_id, sku, descricao, codigo_barras, pendente, data_validade, quantidade,
                   observacao, motivo_id, origem_id)
         join motivos m on m.id = coalesce(i.motivo_id, $2::uuid)
         join origens o on o.id = coalesce(i.origem_id, $3::uuid)
         left join produtos p on p.id = i.produto_id
         where i.produto_id is null or p.id is not null
         returning id`,
        [
          req.loginId, corpo.data.motivoId ?? null, corpo.data.origemId ?? null,
          itens.map((i) => i.produtoId),
          itens.map((i) => i.sku),
          itens.map((i) => i.descricao),
          itens.map((i) => i.codigoBarras),
          itens.map((i) => i.pendente),
          itens.map((i) => i.dataValidade),
          itens.map((i) => i.quantidade),
          itens.map((i) => i.observacao),
          itens.map((i) => i.motivoId ?? null),
          itens.map((i) => i.origemId ?? null),
          loja,
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
      `select ${COLUNAS} ${DESDE} where q.id = any($1::uuid[])`,
      [corpo.data.ids],
    )
    // Sem filtro de loja: a RLS já limita o operador à própria e deixa o
    // administrador apagar o registro de qualquer loja da conta.
    await client.query('delete from quebras where id = any($1::uuid[])', [corpo.data.ids])
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
        lojaId: z.string().uuid().optional(),
        /** Os anexos do registro excluído: o arquivo continua no bucket, só a linha precisa voltar. */
        anexos: z
          .array(
            z.object({
              id: z.string().uuid(),
              tipo: z.enum(['foto-produto', 'foto-etiqueta', 'documento']),
              nome: z.string().max(200),
              mime: z.string().max(100),
              tamanho: z.number().int().min(0),
            }),
          )
          .optional(),
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
       select i.id, coalesce(i.loja_id, $1::uuid), p.id, nullif(i.sku, ''), nullif(i.descricao, ''), nullif(i.codigo_barras, ''),
              i.pendente, i.data_validade, i.quantidade, m.id, o.id, nullif(i.observacao, ''),
              l.id, i.criado_em::timestamptz
       from unnest($2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[], $7::boolean[],
                   $8::date[], $9::int[], $10::uuid[], $11::uuid[], $12::text[], $13::uuid[], $14::text[],
                   $15::uuid[])
            as i(id, produto_id, sku, descricao, codigo_barras, pendente, data_validade, quantidade,
                 motivo_id, origem_id, observacao, criado_por_id, criado_em, loja_id)
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
        r.map((x) => x.lojaId ?? null),
      ],
    )

    // Só volta o anexo de registro que de fato voltou (o `join` em `quebras`), e o
    // caminho é refeito dos ids — nunca aceito do cliente (ver `caminhoDoAnexo`).
    const anexos = r.flatMap((x) => (x.anexos ?? []).map((a) => ({ ...a, quebraId: x.id })))
    if (anexos.length > 0) {
      await client.query(
        `insert into anexos (id, quebra_id, tipo, nome_arquivo, mime_type, tamanho_bytes, storage_path)
         select a.id, a.quebra_id, a.tipo::anexo_tipo, a.nome, a.mime, a.tamanho,
                $1::text || '/' || a.quebra_id::text || '/' || a.id::text
         from unnest($2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[], $7::bigint[])
              as a(id, quebra_id, tipo, nome, mime, tamanho)
         join quebras q on q.id = a.quebra_id
         on conflict (id) do nothing`,
        [
          req.sessao!.contaId,
          anexos.map((a) => a.id),
          anexos.map((a) => a.quebraId),
          anexos.map((a) => a.tipo),
          anexos.map((a) => a.nome),
          anexos.map((a) => a.mime),
          anexos.map((a) => a.tamanho),
        ],
      )
    }
  })
  res.status(204).end()
}))
