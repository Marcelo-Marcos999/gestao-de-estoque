import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Express 4 não entende handler assíncrono de verdade: se uma Promise
 * dentro de uma rota rejeita, ninguém chama `next(erro)` sozinho — vira uma
 * rejeição não tratada, e o padrão do Node é encerrar o processo inteiro.
 * Ou seja, sem este wrapper, um valor inesperado numa requisição de um
 * cliente qualquer derruba o servidor pra TODOS os outros também.
 *
 * Isto envolve a rota, captura a rejeição e entrega pro `next`, que o
 * middleware de erro em `app.ts` transforma numa resposta 500 normal — pro
 * processo continuar de pé pras próximas requisições.
 */
export function assincrono(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}
