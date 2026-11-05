import { ApiError } from '@/shared/lib/http'
import { limitMessage } from '@/shared/lib/limits'

/** Texto para o que o servidor pode recusar ao gravar um item. */
export function messageOf(erro: unknown): string {
  const limit = limitMessage(erro)
  if (limit) return limit
  if (erro instanceof ApiError) {
    if (erro.codigo === 'pedido_fechado') return 'Este pedido foi fechado em outro aparelho. Reabra o pedido para alterar os itens.'
    if (erro.codigo === 'sem_preco') return 'Este produto não tem preço de venda no estoque desta loja.'
    if (erro.status === 400) return 'O desconto não pode passar do valor do item.'
  }
  return 'Não foi possível gravar o item. Verifique a conexão e tente de novo.'
}
