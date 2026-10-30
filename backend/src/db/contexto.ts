import type { PoolClient } from 'pg'
import { pool } from './pool.js'

export interface SessaoUsuario {
  contaId: string
  /** null quando é admin — admin não fica preso a uma loja. */
  lojaId: string | null
  role: 'admin' | 'operador'
}

/**
 * Toda query que atende uma requisição do cliente passa por aqui — nunca
 * direto no `pool`. É o único lugar do código onde o contexto da sessão
 * (quem está logado) entra no banco, via `set_config`, que é lido pelas
 * políticas de RLS (ver migrations/..._rls.sql).
 *
 * `set_config` com parâmetro de verdade, não `SET LOCAL x = valor`
 * concatenado — SET não aceita bind parameter no protocolo do Postgres, e
 * concatenar string na query é o tipo de atalho que vira injeção de SQL
 * mais cedo ou mais tarde, mesmo com um valor que "parece" seguro.
 */
export async function comContextoDoUsuario<T>(
  sessao: SessaoUsuario,
  executar: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`select set_config('app.conta_id', $1, true)`, [sessao.contaId])
    await client.query(`select set_config('app.loja_id', $1, true)`, [sessao.lojaId ?? ''])
    await client.query(`select set_config('app.role', $1, true)`, [sessao.role])

    const resultado = await executar(client)

    await client.query('COMMIT')
    return resultado
  } catch (erro) {
    await client.query('ROLLBACK')
    throw erro
  } finally {
    // Devolve ao pool — o set_config vale só pra transação que acabou de
    // fechar, não sobrevive pro próximo request que pegar esse client.
    client.release()
  }
}

/**
 * Pra código que roda FORA do contexto de um usuário logado — criação de
 * conta no cadastro (signup), tarefa agendada, etc. Usa a mesma conexão do
 * pool, mas sem setar conta_id/loja_id: só funciona se quem chamar isso
 * estiver conectado como uma role que tem motivo de ver além de uma conta
 * só (nunca a app_runtime comum).
 */
export async function semContextoDeConta<T>(
  executar: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const resultado = await executar(client)
    await client.query('COMMIT')
    return resultado
  } catch (erro) {
    await client.query('ROLLBACK')
    throw erro
  } finally {
    client.release()
  }
}
