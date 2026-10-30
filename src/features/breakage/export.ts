/**
 * Exportação dos registros de quebra para .xlsx.
 *
 * Exporta **o que está na tela** — com os filtros aplicados, na mesma ordem.
 * Exportar sempre a base inteira quebraria a expectativa de quem filtrou por
 * um motivo justamente para levar aquele recorte para a reunião.
 */
import { downloadFile, XLSX_MIME } from '@/shared/lib/download'
import { writeXlsx, type ExportValue } from '@/shared/lib/spreadsheet/writeXlsx'
import { today } from '@/shared/lib/date'
import { labelOf } from './tags'
import type { LossRecord, Tag } from './types'

const HEADER = [
  'Código de barras',
  'SKU',
  'Descrição',
  'Validade',
  'Quantidade',
  'Custo unitário',
  'Total custo',
  'Motivo',
  'Origem',
  'Observação',
  'Anexos',
  'Registrado por',
  'Registrado em',
  'Situação do cadastro',
]

function toRow(record: LossRecord, reasons: Tag[], origins: Tag[]): ExportValue[] {
  return [
    // Código de barras vai como texto: em número, o Excel come o zero à
    // esquerda e mostra 7,89658e+12 numa coluna estreita.
    record.barcode || null,
    record.sku || null,
    record.description || null,
    record.expiryDate ? { date: record.expiryDate } : null,
    record.quantity,
    record.costPrice,
    record.totalCost,
    labelOf(reasons, record.reasonId) || null,
    labelOf(origins, record.originId) || null,
    record.note || null,
    // Os nomes, e não a contagem: "2" não diz se o que falta é a etiqueta.
    record.attachments.map((a) => a.fileName).join(' · ') || null,
    record.createdBy,
    { date: record.createdAt.slice(0, 10) },
    record.pendingProduct ? 'Pendente de cadastro' : 'Cadastrado',
  ]
}

/** Nome do arquivo com a data, para dois exports não se confundirem na pasta. */
export function exportFileName(): string {
  return `quebra-${today()}.xlsx`
}

export function exportLossRecords(records: LossRecord[], reasons: Tag[], origins: Tag[]): void {
  const bytes = writeXlsx({
    name: 'Quebra',
    header: HEADER,
    rows: records.map((record) => toRow(record, reasons, origins)),
  })

  downloadFile(bytes, exportFileName(), XLSX_MIME)
}
