/**
 * Traduz a recusa de limite do banco numa resposta para a pessoa.
 *
 * Quem aplica os limites são os gatilhos de `migrations/..._limites_de_registros_e_arquivos.sql`:
 * valem para qualquer caminho que insere (cadastro, importação, "desfazer"), então
 * as rotas não conferem nada por conta própria. Elas só deixam o erro subir, e o
 * tratador de erros do `app.ts` usa esta função para virar um 409 legível — o
 * mesmo código que o limite de logins já usa.
 */

/** SQLSTATE 53400, `configuration_limit_exceeded`: o gatilho levanta exatamente este. */
const LIMITE_EXCEDIDO = '53400'

const RESPOSTAS = {
  limite_registros: {
    codigo: 'limite_registros',
    erro: 'A conta atingiu o limite de registros do plano. Exclua o que não usa mais ou fale com o suporte.',
  },
  limite_armazenamento: {
    codigo: 'limite_armazenamento',
    erro: 'A conta atingiu o limite de armazenamento de arquivos do plano. Exclua anexos que não usa mais ou fale com o suporte.',
  },
} as const

export function respostaDeLimite(erro: unknown): (typeof RESPOSTAS)[keyof typeof RESPOSTAS] | null {
  if (typeof erro !== 'object' || erro === null) return null
  const { code, message } = erro as { code?: unknown; message?: unknown }
  if (code !== LIMITE_EXCEDIDO || typeof message !== 'string') return null
  return message in RESPOSTAS ? RESPOSTAS[message as keyof typeof RESPOSTAS] : null
}
