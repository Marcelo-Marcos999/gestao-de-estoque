import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { poolAuth } from '../db/poolAuth.js'
import { gerarTokenPlataforma } from '../auth/jwt.js'
import { exigirPlataforma } from '../auth/plataforma.js'
import { conferirSenha } from '../auth/senha.js'
import { assincrono } from '../lib/assincrono.js'
import { ArmazenamentoIndisponivel, confirmacaoConfere, excluirContaCompleta } from '../lib/exclusaoDeConta.js'

/**
 * O painel do dono do sistema: lista as empresas, ajusta o limite de cada uma e
 * exclui uma empresa por completo. Mora em /plataforma, com login próprio
 * (`administradores_plataforma`), e NADA aqui é alcançável com um login de cliente.
 */
export const rotasPlataforma = Router()

// Mais apertado que o login de cliente: aqui só entra o dono do sistema, então
// qualquer rajada de erros é ataque, não alguém esquecendo a senha.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.' },
})

const corpoLogin = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1).max(200),
})

rotasPlataforma.post('/login', limiteLogin, assincrono(async (req, res) => {
  const corpo = corpoLogin.safeParse(req.body)
  if (!corpo.success) {
    res.status(400).json({ erro: 'E-mail ou senha em formato inválido.' })
    return
  }

  const { rows } = await poolAuth.query<{ id: string; nome: string; senha_hash: string; ativo: boolean }>(
    'select id, nome, senha_hash, ativo from administradores_plataforma where email = $1',
    [corpo.data.email],
  )
  const admin = rows[0]

  // Mesma defesa do login de cliente: roda o bcrypt mesmo sem o e-mail existir,
  // pra o tempo de resposta não dizer quais e-mails são de administradores.
  const confere = await conferirSenha(corpo.data.senha, admin?.senha_hash ?? '$2a$12$' + '0'.repeat(53))
  if (!admin || !confere || !admin.ativo) {
    res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
    return
  }

  res.json({ accessToken: gerarTokenPlataforma(admin.id), nome: admin.nome })
}))

rotasPlataforma.use(exigirPlataforma)

interface LinhaDeConta {
  id: string
  nome: string
  criado_em: Date
  email_admin: string | null
  plano: string | null
  limite_usuarios: number | null
  limite_armazenamento_mb: number | null
  limite_registros: number | null
  usuarios_ativos: number
  usuarios_total: number
  registros: string
  arquivos_bytes: string
}

async function listarContas(): Promise<LinhaDeConta[]> {
  const { rows } = await poolAuth.query<LinhaDeConta>('select * from plataforma_listar_contas()')
  return rows
}

rotasPlataforma.get('/contas', assincrono(async (_req, res) => {
  const contas = await listarContas()
  res.json(
    contas.map((c) => ({
      id: c.id,
      nome: c.nome,
      criadoEm: c.criado_em,
      emailAdmin: c.email_admin,
      plano: c.plano ?? 'padrao',
      limiteUsuarios: c.limite_usuarios,
      limiteArmazenamentoMb: c.limite_armazenamento_mb,
      limiteRegistros: c.limite_registros,
      usuariosAtivos: c.usuarios_ativos,
      usuariosTotal: c.usuarios_total,
      // bigint chega como texto pelo driver; os números cabem folgados num double.
      registros: Number(c.registros),
      arquivosBytes: Number(c.arquivos_bytes),
    })),
  )
}))

// Nulo = sem limite. O teto de cada campo é só para barrar erro de digitação.
const limite = (maximo: number) => z.number().int().min(1).max(maximo).nullable()
const corpoLimites = z.object({
  limiteUsuarios: limite(10_000),
  limiteArmazenamentoMb: limite(10_000_000),
  limiteRegistros: limite(2_000_000_000),
})

const parametrosConta = z.object({ id: z.string().uuid() })

rotasPlataforma.patch('/contas/:id/limites', assincrono(async (req, res) => {
  const parametros = parametrosConta.safeParse(req.params)
  const corpo = corpoLimites.safeParse(req.body)
  if (!parametros.success || !corpo.success) {
    res.status(400).json({ erro: 'Limites inválidos. Use números inteiros positivos, ou deixe vazio para sem limite.' })
    return
  }

  const { rows } = await poolAuth.query<{ ok: boolean }>(
    'select plataforma_alterar_limites($1, $2, $3, $4) as ok',
    [parametros.data.id, corpo.data.limiteUsuarios, corpo.data.limiteArmazenamentoMb, corpo.data.limiteRegistros],
  )
  if (!rows[0]?.ok) {
    res.status(404).json({ erro: 'Empresa não encontrada.' })
    return
  }
  res.json(corpo.data)
}))

const corpoExclusao = z.object({ confirmacao: z.string().max(200) })

rotasPlataforma.delete('/contas/:id', assincrono(async (req, res) => {
  const parametros = parametrosConta.safeParse(req.params)
  const corpo = corpoExclusao.safeParse(req.body)
  if (!parametros.success || !corpo.success) {
    res.status(400).json({ erro: 'Digite o nome da empresa para confirmar.' })
    return
  }

  const conta = (await listarContas()).find((c) => c.id === parametros.data.id)
  if (!conta) {
    res.status(404).json({ erro: 'Empresa não encontrada.' })
    return
  }
  if (!confirmacaoConfere(corpo.data.confirmacao, conta.nome)) {
    res.status(400).json({ erro: 'O nome digitado não confere com o da empresa.' })
    return
  }

  try {
    const { arquivosApagados } = await excluirContaCompleta(conta.id)
    // Sem dado pessoal: só ids. Fica no log como rastro de quem apagou o quê.
    console.log(`Conta ${conta.id} excluída pela plataforma (admin ${req.adminPlataformaId}); ${arquivosApagados} arquivo(s).`)
    res.json({ arquivosApagados })
  } catch (erro) {
    if (erro instanceof ArmazenamentoIndisponivel) {
      res.status(503).json({ erro: 'O armazenamento de arquivos está indisponível. Nada foi apagado; tente de novo mais tarde.' })
      return
    }
    throw erro
  }
}))
