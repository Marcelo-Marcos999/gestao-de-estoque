/**
 * Exportação da Auditoria para .xlsx: o que está na tela, com os filtros
 * aplicados (mesma regra das outras telas, ver CLAUDE.md). Leva as mesmas
 * colunas da tabela, e a diferença em número, para a planilha poder somar.
 */
import { downloadFile, XLSX_MIME } from '@/shared/lib/download'
import { writeXlsx, type ExportValue } from '@/shared/lib/spreadsheet/writeXlsx'
import { today } from '@/shared/lib/date'
import { differenceKind, rowCostTotal, rowDifference, rowDifferenceValue, rowSaleTotal } from './compute'
import type { AuditRow } from './types'

const HEADER = [
  'Loja',
  'SKU',
  'Descrição',
  'Código de barras',
  'Estoque',
  'Saídas no período',
  'Valor de custo',
  'Valor de venda',
  'Total de custo',
  'Total de venda',
  'Contagem',
  'Diferença (estoque − contagem)',
  'Situação',
  'Valor da diferença',
]

function toRow(row: AuditRow): ExportValue[] {
  return [
    row.storeName,
    row.sku,
    row.description,
    // Como texto: em número, o Excel come o zero à esquerda do código de barras.
    row.barcode || null,
    row.stock,
    row.outflow,
    row.costPrice,
    row.salePrice,
    rowCostTotal(row),
    rowSaleTotal(row),
    row.counted,
    rowDifference(row),
    differenceKind(row),
    rowDifferenceValue(row),
  ]
}

export function exportAuditRows(rows: AuditRow[]): void {
  const bytes = writeXlsx({ name: 'Auditoria', header: HEADER, rows: rows.map(toRow) })
  downloadFile(bytes, `auditoria-${today()}.xlsx`, XLSX_MIME)
}
