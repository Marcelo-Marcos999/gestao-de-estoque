import { Router } from 'express'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAdmin, exigirAutenticacao } from '../auth/middleware.js'
import { gerarHash, gerarSenhaTemporaria } from '../auth/senha.js'
import { assincrono } from '../lib/assincrono.js'

/**
 * Logins da conta (cada login é uma loja). Só o administrador mexe aqui.
 *
 * Existe porque, sem provedor de e-mail, ninguém consegue criar conta nem
 * recuperar senha sozinho: quem cuida disso é o administrador, entregando uma
 * senha provisória que aparece UMA vez na resposta (o banco guarda só o hash).
 */
export const rotasLojas = Router()

rotasLojas.use(exigirAutenticacao, exigirAdmin)

const UNIQUE_VIOLATION = '23505'

/** Falhas de regra detectadas dentro da transação: lançar faz o ROLLBACK desfazer o que já entrou. */
class LimiteDeUsuarios extends Error {}

const COLUNAS = 'id, nome, email, role, ativo, criado_em'

rotasLojas.get('/', assincrono(async (req, res) => {
  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      `select ${COLUNAS} from lojas order by ativo desc, role, nome`,
    )
    return rows
  })
  res.json(linhas)
}))

/**
 * Confere o limite de logins ativos da conta. A trava por conta segura dois
 * cliques simultâneos até o fim da transação: sem ela, os dois contariam
 * "faltam 1" e passariam juntos do limite.
 */
async function conferirLimite(
  client: import('pg').PoolClient,
  contaId: string,
): Promise<void> {
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [`lojas:${contaId}`])

  const { rows } = await client.query<{ limite: number | null; ativos: number }>(
    `select (select limite_usuarios from configuracoes_conta where conta_id = $1) as limite,
            (select count(*) from lojas where ativo)::int as ativos`,
    [contaId],
  )
  // O `select` sempre devolve uma linha (são duas subconsultas escalares).
  const { limite, ativos } = rows[0]!
  // Limite nulo = sem limite.
  if (limite !== null && ativos >= limite) throw new LimiteDeUsuarios()
}

const corpoNovoLogin = z.object({
  nome: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['admin', 'operador']).default('operador'),
})

rotasLojas.post('/', assincrono(async (req, res) => {
  const corpo = corpoNovoLogin.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'Informe um nome e um e-mail válidos.' })
    return
  }
  const { nome, email, role } = corpo.data

  // O hash (lento de propósito) sai antes da transação: com ele dentro, a
  // trava de limite ficaria presa por ~250 ms a cada criação.
  const senhaTemporaria = gerarSenhaTemporaria()
  const senhaHash = await gerarHash(senhaTemporaria)

  try {
    const loja = await comContextoDoUsuario(req.sessao!, async (client) => {
      await conferirLimite(client, req.sessao!.contaId)

      // O administrador digitou o e-mail e entregou a senha à pessoa: o e-mail
      // vale como confirmado, senão o login ficaria barrado esperando um link
      // que (sem provedor de e-mail) nunca chega.
      const { rows } = await client.query(
        `insert into lojas (conta_id, nome, email, senha_hash, role, email_confirmado_em)
         values ($1, $2, $3, $4, $5, now())
         returning ${COLUNAS}`,
        [req.sessao!.contaId, nome, email, senhaHash, role],
      )
      return rows[0]
    })
    res.status(201).json({ loja, senhaTemporaria })
  } catch (erro) {
    if (erro instanceof LimiteDeUsuarios) {
      res.status(409).json({
        codigo: 'limite_usuarios',
        erro: 'A conta atingiu o limite de logins do plano.',
      })
      return
    }
    // Aqui, diferente do cadastro público, dizer que o e-mail já existe não
    // vaza nada: quem pergunta já é administrador de uma conta.
    if ((erro as { code?: string }).code === UNIQUE_VIOLATION) {
      res.status(409).json({ codigo: 'email_em_uso', erro: 'Já existe um login com esse e-mail.' })
      return
    }
    throw erro
  }
}))

const corpoAtualizarLogin = z
  .object({ nome: z.string().trim().min(2).max(80), ativo: z.boolean() })
  .partial()
  .refine((c) => c.nome !== undefined || c.ativo !== undefined)

rotasLojas.patch('/:id', assincrono(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  const corpo = corpoAtualizarLogin.safeParse(req.body)
  if (!id.success || !corpo.success) {
    res.status(400).json({ erro: 'Dados inválidos.' })
    return
  }

  // Sem esta regra o administrador poderia desativar o único login capaz de
  // reativar os outros, e a conta ficaria sem ninguém que a administre.
  if (id.data === req.loginId && corpo.data.ativo === false) {
    res.status(400).json({ erro: 'Você não pode desativar o próprio login.' })
    return
  }

  try {
    const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
      if (corpo.data.ativo === true) {
        // Reativar também ocupa uma vaga do plano — mas só se estava inativo:
        // conferir sempre travaria quem só renomeia um login numa conta cheia.
        const { rows: atual } = await client.query('select ativo from lojas where id = $1', [id.data])
        if (atual[0] && atual[0].ativo === false) await conferirLimite(client, req.sessao!.contaId)
      }

      // Desativar também derruba as sessões abertas: sem mexer em
      // `senha_alterada_em`, o refresh token (7 dias) continuaria renovando o
      // acesso. O login desativado ainda vale por até 15 min, o prazo do token
      // de acesso.
      const { rows } = await client.query(
        `update lojas
            set nome = coalesce($2, nome),
                ativo = coalesce($3, ativo),
                senha_alterada_em = case when $3 = false then now() else senha_alterada_em end
          where id = $1
          returning ${COLUNAS}`,
        [id.data, corpo.data.nome ?? null, corpo.data.ativo ?? null],
      )
      return rows
    })

    if (linhas.length === 0) {
      res.status(404).json({ erro: 'Login não encontrado.' })
      return
    }
    res.json(linhas[0])
  } catch (erro) {
    if (erro instanceof LimiteDeUsuarios) {
      res.status(409).json({
        codigo: 'limite_usuarios',
        erro: 'A conta atingiu o limite de logins do plano.',
      })
      return
    }
    throw erro
  }
}))

/**
 * Nova senha provisória para quem esqueceu a dela. Encerra as sessões abertas
 * do login (mesmo mecanismo da troca de senha). Para a própria senha existe a
 * troca em Configurações, que exige a senha atual: redefinir a si mesmo por
 * aqui dispensaria essa prova.
 */
rotasLojas.post('/:id/redefinir-senha', assincrono(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  if (!id.success) {
    res.status(400).json({ erro: 'Login inválido.' })
    return
  }
  if (id.data === req.loginId) {
    res.status(400).json({ erro: 'Para trocar a sua própria senha, use "Minha conta".' })
    return
  }

  const senhaTemporaria = gerarSenhaTemporaria()
  const senhaHash = await gerarHash(senhaTemporaria)

  const linhas = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      'update lojas set senha_hash = $2, senha_alterada_em = now() where id = $1 returning id',
      [id.data, senhaHash],
    )
    return rows
  })

  if (linhas.length === 0) {
    res.status(404).json({ erro: 'Login não encontrado.' })
    return
  }
  res.json({ senhaTemporaria })
}))
