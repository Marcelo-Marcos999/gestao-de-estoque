import { Pool } from 'pg'

const connectionString = process.env.AUTH_DATABASE_URL

if (!connectionString) {
  throw new Error('AUTH_DATABASE_URL não definida. Veja .env.example.')
}

/**
 * Pool separado, conectado como `app_auth` — a role que só sabe fazer
 * select em lojas/administradores_plataforma, usada exclusivamente pra
 * resolver "quem é esse e-mail" no login. Nunca usar este pool pra mais
 * nada: ele não tem permissão de verdade (nem grant) em nenhuma outra
 * tabela, então qualquer tentativa de usá-lo fora do login falha na hora,
 * o que é o comportamento certo.
 */
export const poolAuth = new Pool({
  connectionString,
  connectionTimeoutMillis: 10_000,
  max: 3,
})

poolAuth.on('error', (erro) => {
  console.error('Erro inesperado no pool de autenticação:', erro)
})
