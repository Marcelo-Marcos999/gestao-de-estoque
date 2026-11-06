/**
 * Cria (ou redefine a senha de) um administrador da plataforma — o dono do sistema,
 * que entra em /plataforma. Não existe tela para isso de propósito: quem pode criar
 * esse acesso é quem tem a conexão de dono do banco, e a senha é digitada AQUI, no
 * seu terminal, sem eco. Ela nunca vai para argumento de comando, histórico do shell,
 * arquivo ou conversa.
 *
 * Uso (a partir de backend/):
 *   ADMIN_DATABASE_URL='postgresql://dono:...@host/banco?sslmode=require' \
 *     npm run plataforma:criar-admin -- seu@email.com "Seu Nome"
 *
 * `ADMIN_DATABASE_URL` é a conexão do DONO do banco (a mesma das migrações), porque
 * a role dos clientes e a do login não podem escrever em `administradores_plataforma`.
 */
import { stdin, stdout } from 'node:process'
import pg from 'pg'
import { gerarHash, validarSenhaNova } from '../src/auth/senha.js'

// A senha do dono do sistema abre todas as empresas: exige mais que a dos clientes.
const TAMANHO_MINIMO = 12

function lerSenhaSemEco(pergunta: string): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    if (!stdin.isTTY) {
      rejeitar(new Error('Rode num terminal interativo: a senha é digitada sem eco.'))
      return
    }
    stdout.write(pergunta)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let digitado = ''
    const aoDigitar = (tecla: string) => {
      for (const caractere of tecla) {
        if (caractere === '\u0003') {
          stdin.setRawMode(false)
          process.exit(130)
        } else if (caractere === '\r' || caractere === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', aoDigitar)
          stdout.write('\n')
          resolver(digitado)
          return
        } else if (caractere === '\u007f' || caractere === '\b') {
          digitado = digitado.slice(0, -1)
        } else {
          digitado += caractere
        }
      }
    }
    stdin.on('data', aoDigitar)
  })
}

async function principal() {
  const conexao = process.env.ADMIN_DATABASE_URL
  const [emailBruto, ...resto] = process.argv.slice(2)
  const nome = resto.join(' ').trim()
  const email = emailBruto?.trim().toLowerCase()

  if (!conexao || !email || !email.includes('@') || nome.length < 2) {
    console.error('Uso: ADMIN_DATABASE_URL=... npm run plataforma:criar-admin -- email@exemplo.com "Nome"')
    process.exit(1)
  }

  const senha = await lerSenhaSemEco('Senha (não aparece enquanto digita): ')
  const confirmacao = await lerSenhaSemEco('Repita a senha: ')
  if (senha !== confirmacao) throw new Error('As senhas não conferem.')
  if (senha.length < TAMANHO_MINIMO) throw new Error(`Use pelo menos ${TAMANHO_MINIMO} caracteres.`)
  const erro = validarSenhaNova(senha)
  if (erro) throw new Error(erro)

  const cliente = new pg.Client({ connectionString: conexao })
  await cliente.connect()
  try {
    // Já existe com esse e-mail: troca a senha e reativa. É o jeito de recuperar o acesso.
    const { rowCount } = await cliente.query(
      `insert into administradores_plataforma (nome, email, senha_hash)
       values ($1, $2, $3)
       on conflict (email) do update set nome = excluded.nome, senha_hash = excluded.senha_hash, ativo = true`,
      [nome, email, await gerarHash(senha)],
    )
    console.log(rowCount === 1 ? `Administrador da plataforma pronto: ${email}` : 'Nada foi alterado.')
  } finally {
    await cliente.end()
  }
}

principal().catch((erro: Error) => {
  console.error(`Erro: ${erro.message}`)
  process.exit(1)
})
