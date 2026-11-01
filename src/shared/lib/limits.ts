import { ApiError } from './http'

/**
 * O texto para quando o servidor recusa por limite do plano (HTTP 409 com
 * `codigo` de limite). `null` para qualquer outro erro, que cada tela trata do
 * seu jeito.
 *
 * Fica em `shared/` porque qualquer formulário que cria algo pode esbarrar no
 * limite — e sem tratar, o botão ficaria girando para sempre e quem tocou em
 * "Salvar" não saberia que o plano barrou, nem o que fazer.
 */
export function limitMessage(erro: unknown): string | null {
  if (!(erro instanceof ApiError)) return null

  if (erro.codigo === 'limite_registros') {
    return 'O limite de registros do plano foi atingido. Exclua o que não usa mais ou fale com o suporte.'
  }
  if (erro.codigo === 'limite_armazenamento') {
    return 'O limite de armazenamento de arquivos do plano foi atingido. Exclua anexos que não usa mais ou fale com o suporte.'
  }
  return null
}
