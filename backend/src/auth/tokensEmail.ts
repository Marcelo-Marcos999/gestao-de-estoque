import { createHash, randomBytes } from 'node:crypto'

/**
 * Token que vai no link do e-mail (confirmar e-mail, redefinir senha).
 *
 * 32 bytes aleatórios = 256 bits: impossível de adivinhar, então não precisa de
 * nada além do prazo e do uso único pra ser seguro. O banco guarda só o HASH
 * (SHA-256): quem lesse a tabela veria hashes, que não servem de link.
 * SHA-256 simples basta aqui, ao contrário de senha, porque o token já é
 * aleatório e longo — não há "palavra fraca" pra um atacante testar.
 */
export function gerarToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Em formato de intervalo do Postgres, que é como `solicitar_token` recebe. */
export const VALIDADE_CONFIRMACAO = '24 hours'
export const VALIDADE_REDEFINICAO = '1 hour'
