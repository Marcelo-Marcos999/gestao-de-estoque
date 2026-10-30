/**
 * Aplica a planilha de estoque ao cadastro.
 *
 * Separado de `api.ts` só para não passar de ~200 linhas ali. Chama
 * `POST /estoque/importar`, que já faz no servidor exatamente a mesma regra
 * que esta função fazia em memória: SKU conhecido atualiza os números, SKU
 * desconhecido cria o produto como pendente de cadastro (a tela já resolveu
 * por código de barras o que dava, trocando-o pelo SKU do cadastro) (ver
 * backend/src/rotas/estoque.ts).
 */
import { apiFetch } from '@/shared/lib/http'
import { invalidateStore } from './api'

/** Uma linha da planilha de estoque, já com o SKU casado ou não. */
export interface StockImportRow {
  sku: string
  /**
   * Só para o produto que a linha cria como pendente: entra com este código de
   * barras. Linha de produto que já existe é casada pelo SKU e ignora o campo.
   */
  barcode?: string
  /** Ausente quando a coluna não foi mapeada nesta importação: mantém o valor atual. */
  stock?: number
  outflow?: number
  costPrice?: number
  salePrice?: number
}

export interface StockImportResult {
  /** Produtos existentes que tiveram os números atualizados. */
  updated: number
  /** Produtos novos, criados como pendentes por não existirem no cadastro. */
  pendingCreated: number
}

/**
 * Aplica a planilha de estoque, em lotes de 500 — o limite que
 * `POST /estoque/importar` aceita por chamada — devolvendo o controle ao
 * navegador entre eles pra barra de progresso acompanhar uma planilha de
 * milhares de linhas.
 */
export async function bulkUpsertStock(
  rows: StockImportRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<StockImportResult> {
  const BATCH = 500
  let updated = 0
  let pendingCreated = 0

  try {
    for (let i = 0; i < rows.length; i += BATCH) {
      const lote = rows.slice(i, i + BATCH)
      const resultado = await apiFetch<StockImportResult>('/estoque/importar', {
        method: 'POST',
        body: {
          linhas: lote.map((row) => ({
            sku: row.sku,
            codigoBarras: row.barcode,
            saldo: row.stock,
            saidas: row.outflow,
            valorCusto: row.costPrice,
            valorVenda: row.salePrice,
          })),
        },
      })
      updated += resultado.updated
      pendingCreated += resultado.pendingCreated

      onProgress?.(Math.min(i + BATCH, rows.length), rows.length)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally {
    // Também quando falha no meio: os lotes anteriores já foram gravados.
    invalidateStore()
  }

  return { updated, pendingCreated }
}
