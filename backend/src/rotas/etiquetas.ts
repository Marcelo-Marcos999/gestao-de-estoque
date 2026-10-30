import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'

/**
 * Motivos e origens têm a mesma forma, e as rotas também: uma fábrica em vez
 * de duas cópias que, com o tempo, deixariam de ser iguais.
 *
 * A lista é da CONTA (todas as lojas leem a mesma): se cada loja mantivesse a
 * sua, "danificado", "danificada" e "avaria" virariam três motivos e a soma
 * por motivo deixaria de fechar (ver docs/dominio.md).
 */
interface Config {
  /** Nome da tabela. Vem do código, nunca da requisição — por isso pode entrar na query. */
  tabela: 'motivos' | 'origens'
  /** Coluna em `quebras` que aponta pra esta lista. */
  colunaEmQuebras: 'motivo_id' | 'origem_id'
  /** Os mesmos de `criar_conta` (migration 0003): contas anteriores a ela nascem sem lista. */
  padroes: string[]
}

const corpoEtiqueta = z.object({ label: z.string().trim().min(1).max(60) })
const idEtiqueta = z.string().uuid()

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

export function criarRotasEtiquetas({ tabela, colunaEmQuebras, padroes }: Config): Router {
  const rotas = Router()
  rotas.use(exigirAutenticacao)

  /**
   * `uso`: quantos registros de quebra (que este login enxerga) usam a
   * etiqueta. É dica pra tela esconder o "excluir" do que está em uso; quem
   * garante é a chave estrangeira (DELETE devolve 409), porque um operador só
   * vê as quebras da própria loja e não saberia do uso nas outras.
   */
  const SELECT = `select t.id, t.label, t.embutido,
                         (select count(*) from quebras q where q.${colunaEmQuebras} = t.id)::int as uso
                  from ${tabela} t
                  order by t.embutido desc, t.criado_em, t.label`

  rotas.get('/', assincrono(async (req, res) => {
    const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
      const { rows } = await client.query(SELECT)
      if (rows.length > 0) return rows

      // Conta sem nenhuma etiqueta: cria as padrão e relê. `on conflict` porque
      // duas abas abrindo juntas passariam as duas por aqui.
      await client.query(
        `insert into ${tabela} (conta_id, label, embutido)
         select $1, l, true from unnest($2::text[]) as l
         on conflict (conta_id, label) do nothing`,
        [req.sessao!.contaId, padroes],
      )
      return (await client.query(SELECT)).rows
    })
    res.json(linhas)
  }))

  rotas.post('/', assincrono(async (req, res) => {
    const corpo = corpoEtiqueta.safeParse(req.body)
    if (!corpo.success) {
      res.status(400).json({ erro: 'Informe o nome.' })
      return
    }

    try {
      const linha = await comContextoDoUsuario(req.sessao!, async (client) => {
        const { rows } = await client.query(
          `insert into ${tabela} (conta_id, label) values ($1, $2)
           returning id, label, embutido, 0 as uso`,
          [req.sessao!.contaId, corpo.data.label],
        )
        return rows[0]
      })
      res.status(201).json(linha)
    } catch (erro) {
      if ((erro as { code?: string }).code === UNIQUE_VIOLATION) {
        res.status(409).json({ erro: 'Já existe uma etiqueta com esse nome.' })
        return
      }
      throw erro
    }
  }))

  /**
   * Renomear é sempre seguro: a quebra aponta pro id, não pro texto, então
   * corrigir "danificada" pra "Danificado" conserta o que já existe em vez de
   * criar um motivo paralelo.
   */
  rotas.patch('/:id', assincrono(async (req, res) => {
    const id = idEtiqueta.safeParse(req.params.id)
    const corpo = corpoEtiqueta.safeParse(req.body)
    if (!id.success || !corpo.success) {
      res.status(400).json({ erro: 'Nome inválido.' })
      return
    }

    try {
      const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
        const { rows } = await client.query(
          `update ${tabela} set label = $2 where id = $1 returning id, label, embutido`,
          [id.data, corpo.data.label],
        )
        return rows
      })
      if (linhas.length === 0) {
        res.status(404).json({ erro: 'Etiqueta não encontrada.' })
        return
      }
      res.json(linhas[0])
    } catch (erro) {
      if ((erro as { code?: string }).code === UNIQUE_VIOLATION) {
        res.status(409).json({ erro: 'Já existe uma etiqueta com esse nome.' })
        return
      }
      throw erro
    }
  }))

  rotas.delete('/:id', assincrono(async (req, res) => {
    const id = idEtiqueta.safeParse(req.params.id)
    if (!id.success) {
      res.status(400).json({ erro: 'Etiqueta inválida.' })
      return
    }

    try {
      const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
        const { rows } = await client.query(`delete from ${tabela} where id = $1 returning id`, [id.data])
        return rows
      })
      if (linhas.length === 0) {
        res.status(404).json({ erro: 'Etiqueta não encontrada.' })
        return
      }
      res.status(204).end()
    } catch (erro) {
      // Em uso por alguma quebra (de qualquer loja da conta): a chave
      // estrangeira recusa, e é melhor que o código da rota, que não enxerga
      // as quebras das outras lojas.
      if ((erro as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
        res.status(409).json({ erro: 'Esta etiqueta está em uso e não pode ser excluída.' })
        return
      }
      throw erro
    }
  }))

  return rotas
}

export const rotasMotivos = criarRotasEtiquetas({
  tabela: 'motivos',
  colunaEmQuebras: 'motivo_id',
  padroes: ['Vencido', 'Danificado', 'Avaria de transporte', 'Divergência de quantidade', 'Furto ou perda'],
})

export const rotasOrigens = criarRotasEtiquetas({
  tabela: 'origens',
  colunaEmQuebras: 'origem_id',
  padroes: ['Centro de distribuição', 'Loja', 'Fornecedor'],
})
