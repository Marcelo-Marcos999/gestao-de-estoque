/**
 * Exportação do acompanhamento de validades para .xlsx.
 *
 * Vão junto os números que sustentam a previsão — estoque, saídas e o período
 * usado. Sem eles, "sai em 195 dias" chega ao Excel como um número sem
 * procedência, impossível de conferir fora do app.
 */
import { downloadFile, XLSX_MIME } from '@/shared/lib/download'
import { writeXlsx, type ExportValue } from '@/shared/lib/spreadsheet/writeXlsx'
import { today } from '@/shared/lib/date'
import { SITUATIONS } from './situation'
import type { ExpiryRow } from './types'

const HEADER = [
  'Código de barras',
  'SKU',
  'Descrição',
  'Validade',
  'Dias até vencer',
  'Estoque',
  'Custo unitário',
  'Total custo',
  'Saídas no período',
  'Dias para zerar',
  'Situação',
  'Período das saídas (dias)',
]

function toRow(row: ExpiryRow, periodDays: number): ExportValue[] {
  return [
    row.barcode || null,
    row.sku,
    row.description,
    row.expiryDate ? { date: row.expiryDate } : null,
    row.daysToExpiry,
    row.stock,
    row.costPrice,
    row.totalCost,
    row.outflow,
    row.daysToZero,
    SITUATIONS[row.situation].label,
    periodDays,
  ]
}

export function exportExpiryRows(rows: ExpiryRow[], periodDays: number): void {
  const bytes = writeXlsx({
    name: 'Validades',
    header: HEADER,
    rows: rows.map((row) => toRow(row, periodDays)),
  })

  downloadFile(bytes, `validades-${today()}.xlsx`, XLSX_MIME)
}
