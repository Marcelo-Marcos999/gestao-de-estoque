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
    // BEGIN e os três valores do contexto vão numa ida só ao banco. O Render (EUA) fica
    // a ~150 ms do Neon (São Paulo), então cada comando separado custava isso em toda
    // requisição, antes mesmo da consulta de verdade.
    //
    // São dois comandos num texto só, e nesse modo (protocolo simples) não há como
    // passar parâmetros: os valores entram escapados por `escapeLiteral`, a função do
    // próprio driver, e não concatenados crus. São o id da conta, o id da loja e o
    // perfil, e mesmo assim passam pelo escape.
    await client.query(
      `BEGIN; select set_config('app.conta_id', ${client.escapeLiteral(sessao.contaId)}, true),
                     set_config('app.loja_id', ${client.escapeLiteral(sessao.lojaId ?? '')}, true),
                     set_config('app.role', ${client.escapeLiteral(sessao.role)}, true)`,
    )

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
