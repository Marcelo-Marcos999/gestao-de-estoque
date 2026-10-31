import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * O caminho sem query string e sem ids, para agrupar no painel: `/anexos/:id`.
 * Parte do endereço pedido, e não de `req.route`, porque o Express zera a rota e
 * o prefixo quando o erro passa pelo tratador de erros — justo quando interessa.
 */
function rotaSemIds(enderecoPedido: string): string {
  return (enderecoPedido.split('?')[0] ?? '').replace(UUID, ':id')
}

/**
 * Registra no log do servidor as requisições que NÃO deram certo.
 *
 * Sem isto, uma recusa (400, 403, 413…) não deixava rastro: o Render só mostrava o
 * que o próprio código escrevia, e um erro de validação não escreve nada. Foi
 * assim que uma importação que falhava só pôde ser diagnosticada reproduzindo-a.
 *
 * O que entra: método, ROTA (o padrão, como `/anexos/:id`, não o endereço com
 * ids), status, duração, a mensagem de erro que a resposta levou e quem pediu
 * (ids do login e da conta). O que NÃO entra: corpo, query string (o nome de um
 * arquivo anexado vai nela), e-mail, senha, IP — dado pessoal não pertence a log.
 *
 * 2xx/3xx não se registram (seria ruído), nem o 401: é o ciclo normal de um token
 * de acesso que expira e é renovado.
 *
 * Cada resposta leva um `x-request-id`; a mesma identificação está na linha do
 * log, para ligar "deu erro às 14h" à linha certa.
 */
export function registrarRequisicoes(req: Request, res: Response, next: NextFunction): void {
  const inicio = process.hrtime.bigint()
  const id = randomUUID().slice(0, 8)
  res.setHeader('x-request-id', id)

  // A mensagem só existe no corpo da resposta; guarda-a quando passa por `json`.
  let erro: string | undefined
  let codigo: string | undefined
  const jsonOriginal = res.json.bind(res)
  res.json = ((corpo?: unknown) => {
    if (corpo && typeof corpo === 'object') {
      const registro = corpo as { erro?: unknown; codigo?: unknown }
      if (typeof registro.erro === 'string') erro = registro.erro
      if (typeof registro.codigo === 'string') codigo = registro.codigo
    }
    return jsonOriginal(corpo)
  }) as typeof res.json

  res.on('finish', () => {
    if (res.statusCode < 400 || res.statusCode === 401) return

    const linha = {
      id,
      metodo: req.method,
      rota: rotaSemIds(req.originalUrl),
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - inicio) / 1e6),
      erro,
      codigo,
      login: req.loginId,
      conta: req.sessao?.contaId,
    }
    // 5xx é defeito nosso; 4xx é recusa de quem chamou — níveis diferentes no painel.
    const escrever = res.statusCode >= 500 ? console.error : console.warn
    escrever(JSON.stringify(linha))
  })

  next()
}
