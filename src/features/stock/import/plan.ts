/**
 * Transforma as linhas da planilha de estoque num plano de importação, antes
 * de gravar qualquer coisa — mesma ideia do cadastro de produtos, com uma
 * regra diferente: aqui não existe "já cadastrado, ignora". Todo produto
 * reconhecido **atualiza** os números; todo SKU desconhecido **cria** um
 * produto pendente (ver docs/dominio.md).
 *
 * O produto é achado pelo SKU e, não achando, pelo código de barras — a mesma
 * ordem de Validades. Uma linha só com código de barras desconhecido não vira
 * produto pendente: o produto precisa de um SKU para existir.
 */
import { cellToNumber, cellToText, digitsOnly } from '@/shared/lib/cell'
import type { CellValue } from '@/shared/lib/spreadsheet'
import type { Product, StockImportRow } from '@/features/products'
import type { ColumnMapping } from './columns'

export type RowStatus = 'atualiza' | 'pendente' | 'duplicado' | 'invalido'

export interface PlannedRow {
  /** Número da linha na planilha, contando o cabeçalho — o que o usuário vê no Excel. */
  lineNumber: number
  status: RowStatus
  /** Como a linha se identifica na revisão: o SKU, ou o código de barras quando não há SKU. */
  label: string
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
  const bySku = new Map(existing.map((p) => [p.sku, p]))
  const byBarcode = new Map(existing.filter((p) => p.barcode).map((p) => [p.barcode, p]))
  // Repetição é por PRODUTO, não pelo texto da linha: o mesmo produto citado
  // uma vez por SKU e outra por código de barras também é repetido.
  const seenProducts = new Set<string>()
  const seenNewSkus = new Set<string>()
  const seenNewBarcodes = new Set<string>()

  const planned: PlannedRow[] = []
  const counts = { ...EMPTY_COUNTS }

  rows.forEach((cells, index) => {
    const lineNumber = index + 2 // +1 pelo cabeçalho, +1 porque o Excel conta de 1
    const sku = mapping.sku >= 0 ? cellToText(cells[mapping.sku]) : ''
    const barcode = mapping.barcode >= 0 ? digitsOnly(cellToText(cells[mapping.barcode])) : ''
    const label = sku || barcode

    const draft: StockImportRow = {
      sku,
      stock: readNumber(cells, mapping.stock),
      outflow: readNumber(cells, mapping.outflow),
      costPrice: readNumber(cells, mapping.costPrice),
      salePrice: readNumber(cells, mapping.salePrice),
    }

    const plan = (status: RowStatus, reason?: string) => {
      counts[status]++
      planned.push({ lineNumber, status, label, row: draft, reason })
    }

    if (!label) return plan('invalido', 'Sem SKU nem código de barras')

    const product = (sku ? bySku.get(sku) : undefined) ?? (barcode ? byBarcode.get(barcode) : undefined)

    if (product) {
      if (seenProducts.has(product.id)) return plan('duplicado', 'Produto repetido na própria planilha')
      seenProducts.add(product.id)
      // O servidor casa pelo SKU: a linha achada pelo código de barras passa a trazer o do cadastro.
      draft.sku = product.sku
      // Só vale avisar quando a linha trazia um SKU que não casou: numa planilha só de
      // códigos de barras, dizer isso em toda linha seria ruído.
      return plan('atualiza', sku && sku !== product.sku ? 'Casado pelo código de barras' : undefined)
    }

    // Produto desconhecido: só o SKU permite criá-lo como pendente.
    if (!sku) return plan('invalido', 'Código de barras fora do cadastro e linha sem SKU')
    if (seenNewSkus.has(sku)) return plan('duplicado', 'SKU repetido na própria planilha')
    // Dois SKUs novos com o mesmo código de barras criariam produtos que o
    // cadastro não aceita juntos (o código de barras é único por empresa).
    if (barcode && seenNewBarcodes.has(barcode)) {
      return plan('duplicado', 'Código de barras repetido na própria planilha')
    }

    seenNewSkus.add(sku)
    if (barcode) {
      seenNewBarcodes.add(barcode)
      draft.barcode = barcode
    }
    return plan('pendente', 'SKU não está no cadastro; entra como pendente')
  })

  return { rows: planned, counts, total: planned.length }
}

/** Só o que a importação de fato aplica — duplicado e inválido ficam de fora. */
export function rowsToImport(plan: ImportPlan): StockImportRow[] {
  return plan.rows
    .filter((r) => r.status === 'atualiza' || r.status === 'pendente')
    .map((r) => r.row)
}
