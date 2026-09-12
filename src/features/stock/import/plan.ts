/**
 * Transforma as linhas da planilha de estoque num plano de importação, antes
 * de gravar qualquer coisa — mesma ideia do cadastro de produtos, com uma
 * regra diferente: aqui não existe "já cadastrado, ignora". Todo SKU
 * reconhecido **atualiza** os números do produto; todo SKU desconhecido
 * **cria** um produto pendente (ver docs/dominio.md).
 */
import { cellToNumber, cellToText } from '@/shared/lib/cell'
import type { CellValue } from '@/shared/lib/spreadsheet'
import type { Product, StockImportRow } from '@/features/products'
import type { ColumnMapping } from './columns'

export type RowStatus = 'atualiza' | 'pendente' | 'duplicado' | 'invalido'

export interface PlannedRow {
  /** Número da linha na planilha, contando o cabeçalho — o que o usuário vê no Excel. */
  lineNumber: number
  status: RowStatus
  row: StockImportRow
  reason?: string
}

export interface ImportPlan {
  rows: PlannedRow[]
  counts: Record<RowStatus, number>
  total: number
}

const EMPTY_COUNTS: Record<RowStatus, number> = {
  atualiza: 0,
  pendente: 0,
  duplicado: 0,
  invalido: 0,
}

/** Lê a coluna se ela foi mapeada; `undefined` quando não foi — mantém o valor atual do produto. */
function readNumber(row: CellValue[], column: number): number | undefined {
  if (column < 0) return undefined
  const numero = cellToNumber(row[column])
  return numero ?? undefined
}

export function buildImportPlan(
  rows: CellValue[][],
  mapping: ColumnMapping,
  existing: Product[],
): ImportPlan {
  const bySku = new Set(existing.map((p) => p.sku))
  const seenSku = new Set<string>()

  const planned: PlannedRow[] = []
  const counts = { ...EMPTY_COUNTS }

  rows.forEach((cells, index) => {
    const lineNumber = index + 2 // +1 pelo cabeçalho, +1 porque o Excel conta de 1
    const sku = mapping.sku >= 0 ? cellToText(cells[mapping.sku]) : ''

    const draft: StockImportRow = {
      sku,
      stock: readNumber(cells, mapping.stock),
      outflow: readNumber(cells, mapping.outflow),
      costPrice: readNumber(cells, mapping.costPrice),
      salePrice: readNumber(cells, mapping.salePrice),
    }

    let status: RowStatus
    let reason: string | undefined

    if (!sku) {
      status = 'invalido'
      reason = 'Sem código SKU'
    } else if (seenSku.has(sku)) {
      status = 'duplicado'
      reason = 'SKU repetido na própria planilha'
    } else if (bySku.has(sku)) {
      status = 'atualiza'
      seenSku.add(sku)
    } else {
      status = 'pendente'
      reason = 'SKU não está no cadastro; entra como pendente'
      seenSku.add(sku)
    }

    counts[status]++
    planned.push({ lineNumber, status, row: draft, reason })
  })

  return { rows: planned, counts, total: planned.length }
}

/** Só o que a importação de fato aplica — duplicado e inválido ficam de fora. */
export function rowsToImport(plan: ImportPlan): StockImportRow[] {
  return plan.rows
    .filter((r) => r.status === 'atualiza' || r.status === 'pendente')
    .map((r) => r.row)
}
