import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  // Falha rápido e alto, não na primeira query que alguém disparar.
  throw new Error('DATABASE_URL não definida. Veja .env.example.')
}

// Pool único pro processo inteiro. Cada requisição pega um client
// emprestado, usa dentro de uma transação e devolve — nunca guarda
// client global, porque RLS depende do contexto setado naquela
// transação específica (ver contexto.ts).
export const pool = new Pool({
  connectionString,
  // Neon dorme por inatividade em planos menores; sem isso, a primeira
  // conexão depois de um tempo parado pode estourar o timeout padrão.
  connectionTimeoutMillis: 10_000,
  max: 10,
  // Abrir uma conexão nova com o Neon (TCP + TLS + autenticação) custa várias idas de
  // ~150 ms do Render até São Paulo. O padrão do pool fecha a conexão parada depois de
  // 10 s, então quem usa o app aos poucos pagava isso quase toda vez. Cinco minutos
  // cobrem o ritmo de uso da loja; o keep-alive impede que um intermediário derrube a
  // conexão parada sem avisar.
  idleTimeoutMillis: 5 * 60_000,
  keepAlive: true,
})

pool.on('error', (erro) => {
  // Erro em client ocioso no pool não deveria derrubar o processo.
  console.error('Erro inesperado no pool do Postgres:', erro)
})
