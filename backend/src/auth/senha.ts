import bcrypt from 'bcryptjs'

// 12 rounds é o piso recomendado hoje (2024+) pra bcrypt — abaixo disso fica
// rápido demais pra tentativa em massa com hardware atual; acima começa a
// pesar no tempo de resposta do login sem ganho real de segurança.
const RODADAS = 12

export const TAMANHO_MINIMO_SENHA = 8

/**
 * Regra de senha NOVA (cadastro, redefinição, troca). Igual à da tela, mas
 * repetida aqui de propósito: a validação do formulário é conforto, quem
 * garante a regra é o servidor.
 *
 * O teto de 72 BYTES é do bcrypt, que ignora em silêncio tudo depois disso:
 * sem o limite, duas senhas longas que só diferem no final virariam a mesma.
 * É em bytes, não em caracteres, porque "ç" e emoji ocupam mais de um.
 */
export function validarSenhaNova(senha: string): string | null {
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    return `A senha precisa de pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`
  }
  if (Buffer.byteLength(senha, 'utf8') > 72) {
    return 'A senha é longa demais (máximo de 72 bytes).'
  }
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return 'A senha precisa misturar letras e números.'
  }
  return null
}

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, RODADAS)
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}
