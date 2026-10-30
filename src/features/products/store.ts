/**
 * Junta GET /produtos (catálogo da conta) com GET /estoque (números da loja
 * de quem está logado) num único `Product`, e guarda o resultado em cache —
 * ver cabeçalho de `api.ts` pra por que essas duas rotas são separadas.
 *
 * Isolado num módulo próprio pra `api.ts` não crescer com o mapeamento e o
 * cache misturados nas funções que as telas chamam (ver CLAUDE.md,
 * "Tamanho de arquivo").
 */
import { apiFetch } from '@/shared/lib/http'
import type { Product } from './types'

export interface ProdutoApi {
  id: string
  sku: string
  descricao: string
  codigo_barras: string | null
  pendente_cadastro: boolean
  criado_em: string
  atualizado_em: string | null
}

export interface EstoqueApi {
  produto_id: string
  saldo: number
  saidas: number
  valor_custo: string
  valor_venda: string
}

export function paraProduct(p: ProdutoApi, e?: EstoqueApi): Product {
  return {
    id: p.id,
    sku: p.sku,
    description: p.descricao,
    barcode: p.codigo_barras ?? '',
    // numeric do Postgres chega como string em JSON — Number() converte sem
    // o arredondamento que um parseFloat apressado poderia introduzir.
    stock: e?.saldo ?? 0,
    outflow: e?.saidas ?? 0,
    costPrice: e ? Number(e.valor_custo) : 0,
    salePrice: e ? Number(e.valor_venda) : 0,
    pendingCadastro: p.pendente_cadastro,
    createdAt: p.criado_em,
    updatedAt: p.atualizado_em ?? p.criado_em,
  }
}

let cache: Product[] | null = null
let carregando: Promise<Product[]> | null = null

/**
 * Busca e junta as duas rotas uma vez só, reaproveitando o resultado nas
 * chamadas seguintes. `carregando` evita a corrida clássica de duas telas
 * pedindo a lista ao mesmo tempo e cada uma disparando sua própria dupla de
 * requisições.
 */
export async function carregar(): Promise<Product[]> {
  if (cache) return cache
  if (carregando) return carregando

  carregando = (async () => {
    const [produtos, estoque] = await Promise.all([
      apiFetch<ProdutoApi[]>('/produtos'),
      apiFetch<EstoqueApi[]>('/estoque'),
    ])
    const estoquePorProduto = new Map(estoque.map((e) => [e.produto_id, e]))
    const produtosCarregados = produtos.map((p) => paraProduct(p, estoquePorProduto.get(p.id)))
    cache = produtosCarregados
    return produtosCarregados
  })()

  try {
    return await carregando
  } finally {
    carregando = null
  }
}

/** Qualquer escrita chama isto: a próxima leitura busca tudo de novo em vez de arriscar divergir do servidor. */
export function invalidar(): void {
  cache = null
}
