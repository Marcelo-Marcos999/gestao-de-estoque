import bcrypt from 'bcryptjs'

// 12 rounds é o piso recomendado hoje (2024+) pra bcrypt — abaixo disso fica
// rápido demais pra tentativa em massa com hardware atual; acima começa a
// pesar no tempo de resposta do login sem ganho real de segurança.
const RODADAS = 12

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, RODADAS)
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}
