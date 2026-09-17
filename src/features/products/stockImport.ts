/**
 * Aplica a planilha de estoque ao cadastro.
 *
 * Separado de `api.ts` só para não passar de ~200 linhas ali — continua
 * mexendo no mesmo `store`, através de `getStoreSnapshot`/`replaceStore`.
 */
import { getStoreSnapshot, replaceStore } from './api'
import type { Product } from './types'

/** Uma linha da planilha de estoque, já com o SKU casado ou não. */
export interface StockImportRow {
  sku: string
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
 * Aplica a planilha de estoque: atualiza quem já está no cadastro e cria como
 * pendente quem não está.
 *
 * Não bloquear pelo SKU desconhecido é a mesma decisão da quebra: a
 * importação normalmente é a única fonte desses números, e recusar a linha
 * até o administrador cadastrar o produto perderia o dado (ver
 * docs/dominio.md).
 */
export async function bulkUpsertStock(
  rows: StockImportRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<StockImportResult> {
  const BATCH = 500
  const now = new Date().toISOString()
  const store = getStoreSnapshot()
  const bySku = new Map(store.map((p) => [p.sku, p]))

  let updated = 0
  const pending: Product[] = []

  for (let i = 0; i < rows.length; i += BATCH) {
    for (const row of rows.slice(i, i + BATCH)) {
      const existing = bySku.get(row.sku)

      if (existing) {
        const patched: Product = {
          ...existing,
          stock: row.stock !== undefined ? Math.max(0, Math.round(row.stock)) : existing.stock,
          outflow:
            row.outflow !== undefined ? Math.max(0, Math.round(row.outflow)) : existing.outflow,
          costPrice:
            row.costPrice !== undefined ? Math.max(0, row.costPrice) : existing.costPrice,
          salePrice:
            row.salePrice !== undefined ? Math.max(0, row.salePrice) : existing.salePrice,
          updatedAt: now,
        }
        bySku.set(row.sku, patched)
        updated++
      } else {
        const created: Product = {
          id: `p${row.sku}-${now}-${pending.length}`,
          sku: row.sku,
          description: '',
          barcode: '',
          stock: Math.max(0, Math.round(row.stock ?? 0)),
          outflow: Math.max(0, Math.round(row.outflow ?? 0)),
          costPrice: Math.max(0, row.costPrice ?? 0),
          salePrice: Math.max(0, row.salePrice ?? 0),
          pendingCadastro: true,
          createdAt: now,
          updatedAt: now,
        }
        bySku.set(row.sku, created)
        pending.push(created)
      }
    }

    onProgress?.(Math.min(i + BATCH, rows.length), rows.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  replaceStore([...pending, ...store.map((p) => bySku.get(p.sku) ?? p)])
  return { updated, pendingCreated: pending.length }
}
