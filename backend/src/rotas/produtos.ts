import { Router, type Response } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAdmin, exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'

export const rotasProdutos = Router()

// Toda rota aqui exige sessão válida; a RLS faz o resto — a query abaixo
// nem filtra por conta_id na mão, porque filtrar é trabalho do banco, não
// do código de rota (ver migrations/..._rls.sql).
rotasProdutos.use(exigirAutenticacao)

// Sem paginação de propósito, por enquanto: a tela filtra e ordena no
// cliente (ver features/products/api.ts), herdando a mesma estratégia que
// o modo em memória já usava. Pra uma conta com catálogo muito maior que
// alguns milhares de SKUs, isso precisa virar paginação de verdade — fica
// anotado como próximo passo, não escondido.
rotasProdutos.get('/', assincrono(async (req, res) => {
  const produtos = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select id, sku, descricao, codigo_barras, pendente_cadastro, criado_em, atualizado_em
       from produtos
       order by descricao`,
    )
    return rows
  })
  res.json(produtos)
}))

const corpoNovoProduto = z.object({
  sku: z.string().trim().min(1),
  descricao: z.string().trim().min(1),
  codigoBarras: z.string().trim().optional(),
})

/**
 * sku_duplicado/barras_duplicado espelham o `SaveError` que a tela de
 * cadastro já sabe mostrar — em vez de inventar um formato de erro novo
 * pro back-end, reaproveita o que o front já criou quando isso vivia em
 * memória, pra `features/products/api.ts` só trocar de onde vem.
 */
function respostaDeConflito(res: Response, erro: unknown) {
  const pg = erro as { code?: string; constraint?: string }
  if (pg.code !== '23505') return false

  const codigo = pg.constraint === 'produtos_codigo_barras_unico' ? 'barras_duplicado' : 'sku_duplicado'
  res.status(409).json({ codigo })
  return true
}

// Só admin cadastra — a RLS também bloquearia um operador tentando, mas
// checar aqui também devolve um erro claro (403) em vez de um "zero linhas
// afetadas" confuso de entender do lado do cliente.
rotasProdutos.post('/', exigirAdmin, assincrono(async (req, res) => {
  const corpo = corpoNovoProduto.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Dados do produto inválidos.' })
    return
  }

  try {
    const produto = await comContextoDoUsuario(req.sessao!, async (client) => {
      const { rows } = await client.query(
        `insert into produtos (conta_id, sku, descricao, codigo_barras)
         values ($1, $2, $3, $4)
         returning id, sku, descricao, codigo_barras, pendente_cadastro, criado_em, atualizado_em`,
        [req.sessao!.contaId, corpo.data.sku, corpo.data.descricao, corpo.data.codigoBarras ?? null],
      )
      return rows[0]
    })

    res.status(201).json(produto)
  } catch (erro) {
    if (!respostaDeConflito(res, erro)) throw erro
  }
}))

const corpoEditarProduto = z.object({
  sku: z.string().trim().min(1),
  descricao: z.string().trim().min(1),
  codigoBarras: z.string().trim().optional(),
})

// Editar sempre fecha a pendência: SKU, descrição e código de barras são
// exatamente os três campos que faltam num produto pendente_cadastro=true
// (ver docs/dominio.md) — se o admin está preenchendo os três agora, a
// pendência acabou de ser resolvida.
rotasProdutos.patch('/:id', exigirAdmin, assincrono(async (req, res) => {
  const corpo = corpoEditarProduto.safeParse(req.body)
  // Um id que não é uuid chegava ao Postgres e voltava como 500; é erro de quem chamou.
  const id = z.string().uuid().safeParse(req.params.id)
  if (!corpo.success || !id.success) {
    res.status(400).json({ erro: 'Dados do produto inválidos.' })
    return
  }

  try {
    const produto = await comContextoDoUsuario(req.sessao!, async (client) => {
      const { rows } = await client.query(
        `update produtos
         set sku = $1, descricao = $2, codigo_barras = $3, pendente_cadastro = false
         where id = $4
         returning id, sku, descricao, codigo_barras, pendente_cadastro, criado_em, atualizado_em`,
        [corpo.data.sku, corpo.data.descricao, corpo.data.codigoBarras ?? null, id.data],
      )
      return rows[0]
    })

    if (!produto) {
      res.status(404).json({ erro: 'Produto não encontrado.' })
      return
    }

    res.json(produto)
  } catch (erro) {
    if (!respostaDeConflito(res, erro)) throw erro
  }
}))

const corpoExcluirProdutos = z.object({
  // 5000 por chamada: a tela envia em lotes de 2000, e o corpo precisa caber no limite de 1 MB.
  ids: z.array(z.string().uuid()).min(1).max(5000),
  /** Apaga junto o estoque (em todas as lojas da conta) e, por cascata, os lotes de validade. */
  comEstoque: z.boolean().default(false),
})

/**
 * Exclui em lote, devolvendo só o que saiu de verdade.
 *
 * Por padrão, um produto com estoque em alguma loja (linha em `estoque`) NÃO é
 * excluído — a condição `not exists` tira esses ids do DELETE num só comando,
 * em vez de um laço linha a linha, sem quebrar o restante do lote. Quem chama
 * descobre quais ficaram comparando com o que pediu, e a tela explica e
 * pergunta (ver `useProductDeletion`).
 *
 * Com `comEstoque`, a pessoa confirmou que quer apagar também o estoque desses
 * produtos: as posições saem primeiro (e os lotes de validade junto, por
 * cascata) e então os produtos. As quebras ficam, com o produto zerado
 * (`on delete set null`).
 */
rotasProdutos.delete('/', exigirAdmin, assincrono(async (req, res) => {
  const corpo = corpoExcluirProdutos.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Lista de ids inválida.' })
    return
  }

  const removidos = await comContextoDoUsuario(req.sessao!, async (client) => {
    if (corpo.data.comEstoque) {
      await client.query('delete from estoque where produto_id = any($1::uuid[])', [corpo.data.ids])
    }

    const { rows } = await client.query(
      `delete from produtos
       where id = any($1)
         and not exists (select 1 from estoque e where e.produto_id = produtos.id)
       returning id, sku, descricao, codigo_barras, pendente_cadastro`,
      [corpo.data.ids],
    )
    return rows
  })

  res.json(removidos)
}))

const corpoRestaurarProdutos = z.object({
  produtos: z
    .array(
      z.object({
        id: z.string().uuid(),
        sku: z.string().trim().min(1),
        descricao: z.string().trim().min(1),
        codigoBarras: z.string().trim().optional(),
        pendingCadastro: z.boolean(),
      }),
    )
    .min(1),
})

/**
 * Desfaz uma exclusão recente — a tela de cadastro tem "desfazer" na barra
 * de seleção e precisa que o produto volte com o MESMO id de antes, senão
 * qualquer referência que ainda exista na tela (seleção marcada, por
 * exemplo) ficaria apontando pra um id que não existe mais.
 *
 * `on conflict do nothing` cobre clicar em desfazer duas vezes: a segunda
 * tentativa não quebra, só não faz nada.
 */
rotasProdutos.post('/restaurar', exigirAdmin, assincrono(async (req, res) => {
  const corpo = corpoRestaurarProdutos.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Lista de produtos pra restaurar inválida.' })
    return
  }

  const restaurados = await comContextoDoUsuario(req.sessao!, async (client) => {
    const linhas = []
    for (const produto of corpo.data.produtos) {
      const { rows } = await client.query(
        `insert into produtos (id, conta_id, sku, descricao, codigo_barras, pendente_cadastro)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing
         returning id, sku, descricao, codigo_barras, pendente_cadastro, criado_em, atualizado_em`,
        [
          produto.id,
          req.sessao!.contaId,
          produto.sku,
          produto.descricao,
          produto.codigoBarras ?? null,
          produto.pendingCadastro,
        ],
      )
      if (rows[0]) linhas.push(rows[0])
    }
    return linhas
  })

  res.json(restaurados)
}))

const corpoImportarProdutos = z.object({
  produtos: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        descricao: z.string().trim().min(1),
        codigoBarras: z.string().trim().optional(),
      }),
    )
    .min(1)
    .max(5000),
})

/**
 * Importação em lote do cadastro (planilha de produtos). A tela de revisão
 * já filtra SKU e código de barras duplicados antes de chegar aqui (ver
 * import/plan.ts no front); se algum passar mesmo assim, `on conflict do
 * nothing` ignora só aquela linha, sem derrubar o lote.
 *
 * Um único INSERT com arrays (`unnest`), não um comando por linha. Cada
 * ida ao banco custa ~150 ms entre o Render (EUA) e o Neon (São Paulo): com
 * um comando por linha, 25 mil produtos levavam mais de uma hora e cada
 * requisição estourava o tempo limite do Render. Assim é uma ida por lote.
 */
rotasProdutos.post('/importar-lote', exigirAdmin, assincrono(async (req, res) => {
  const corpo = corpoImportarProdutos.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Produtos da importação inválidos.' })
    return
  }

  const { produtos } = corpo.data

  const criados = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rowCount } = await client.query(
      `insert into produtos (conta_id, sku, descricao, codigo_barras)
       select $1, t.sku, t.descricao, nullif(t.codigo_barras, '')
       from unnest($2::text[], $3::text[], $4::text[]) as t(sku, descricao, codigo_barras)
       on conflict do nothing`,
      [
        req.sessao!.contaId,
        produtos.map((p) => p.sku),
        produtos.map((p) => p.descricao),
        produtos.map((p) => p.codigoBarras ?? null),
      ],
    )
    return rowCount ?? 0
  })

  res.status(201).json({ criados })
}))
