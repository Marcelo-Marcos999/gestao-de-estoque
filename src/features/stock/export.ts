/**
 * Exportação da tela de Estoque para .xlsx.
 *
 * Exporta o que está na tela, com os filtros aplicados — mesma regra das
 * outras telas do sistema (ver CLAUDE.md).
 */
import { downloadFile, XLSX_MIME } from '@/shared/lib/download'
import { writeXlsx, type ExportValue } from '@/shared/lib/spreadsheet/writeXlsx'
import { today } from '@/shared/lib/date'
import type { StockRow } from './types'

const HEADER = [
  'SKU',
  'Descrição',
  'Código de barras',
  'Estoque',
  'Saídas no período',
  'Valor de custo',
  'Valor de venda',
  'Pendente de cadastro',
]

function toRow(row: StockRow): ExportValue[] {
  return [
    row.sku,
    row.description,
    // Como texto: em número, o Excel come o zero à esquerda do código de barras.
    row.barcode || null,
    row.stock,
    row.outflow,
    row.costPrice,
    row.salePrice,
    row.pendingCadastro ? 'sim' : 'não',
  ]
}

export function exportStockRows(rows: StockRow[]): void {
  const bytes = writeXlsx({
    name: 'Estoque',
    header: HEADER,
    rows: rows.map(toRow),
  })

  downloadFile(bytes, `estoque-${today()}.xlsx`, XLSX_MIME)
}
