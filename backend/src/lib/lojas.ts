import type { Request, Response } from 'express'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * De quais lojas uma LEITURA traz registros, pelo parâmetro `?loja=`:
 *
 * - `todas` → `null`: sem filtro de loja. Quem decide o que cada perfil enxerga
 *   é a RLS — o administrador vê a conta inteira; o operador, só a própria loja,
 *   mesmo que peça "todas".
 * - um id → aquela loja (a RLS esconde o que não for da conta).
 * - ausente → a loja do próprio login, que é o que as telas sempre pediram. O
 *   padrão não muda de propósito: o cadastro de produtos, a previsão de
 *   validade e a quebra leem o estoque da loja de quem está logado, e passar a
 *   somar todas as lojas aí misturaria saldos que não são comparáveis.
 */
export function lojaDaConsulta(req: Request): string | null {
  const loja = req.query.loja
  if (loja === 'todas') return null
  if (typeof loja === 'string' && UUID.test(loja)) return loja
  return req.loginId!
}

/**
 * Em qual loja uma ESCRITA age: a do login, ou — só o administrador — a de
 * `?loja=<id>`. Devolve `null` (e já responde 403) quando um operador tenta
 * mexer na loja de outro: a RLS barraria, mas com um erro de banco em vez de uma
 * resposta que a tela entende.
 */
export function lojaDaEscrita(req: Request, res: Response): string | null {
  const alvo = lojaDaConsulta(req) ?? req.loginId!
  if (alvo !== req.loginId && req.sessao?.role !== 'admin') {
    res.status(403).json({ erro: 'Só o administrador pode mexer no estoque de outra loja.' })
    return null
  }
  return alvo
}
