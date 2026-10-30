/**
 * Transforma as linhas da planilha de validades num plano, antes de gravar
 * qualquer coisa. Cada linha vira um lote **novo**, ou é pulada por um motivo
 * que a revisão mostra: lote que já existe, linha repetida na própria
 * planilha, produto fora do cadastro ou data que não deu para ler.
 *
 * Produto desconhecido NÃO é criado aqui, diferente da importação de estoque:
 * lá o SKU novo vira produto pendente porque traz saldo e custo; uma validade
 * sozinha não basta para inventar um produto (ver docs/dominio.md).
 */
import { cellToText, digitsOnly } from '@/shared/lib/cell'
import { parseDate, type IsoDate } from '@/shared/lib/date'
import type { SheetData } from '@/shared/lib/spreadsheet'
import type { ColumnMapping } from '@/shared/import/fields'
import type { Product } from '@/features/products'
import type { ExpiryItem } from '../types'
import type { ExpiryImportField } from './columns'

export type ExpiryRowStatus = 'novo' | 'existente' | 'duplicado' | 'invalido'

export interface PlannedLot {
  /** Número da linha na planilha, contando o cabeçalho — o que a pessoa vê no Excel. */
  lineNumber: number
  status: ExpiryRowStatus
  /** Como a linha se identifica na revisão: SKU, ou o código de barras quando não há SKU. */
  label: string
  productId?: string
  expiryDate?: IsoDate
  reason?: string
}

export interface ExpiryImportPlan {
  rows: PlannedLot[]
  counts: Record<ExpiryRowStatus, number>
}

const NOT_CHOSEN = 'Escolha a coluna de SKU ou de código de barras.'

/** Falta de coluna além dos campos obrigatórios: é preciso um jeito de achar o produto. */
export function checkExpiryMapping(mapping: ColumnMapping<ExpiryImportField>): string | null {
  return mapping.sku < 0 && mapping.barcode < 0 ? NOT_CHOSEN : null
}

export function buildExpiryPlan(
  sheet: SheetData,
  mapping: ColumnMapping<ExpiryImportField>,
  products: Product[],
  existing: ExpiryItem[],
): ExpiryImportPlan {
  const bySku = new Map(products.map((p) => [p.sku, p]))
  const byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode, p]))
  // O que já está gravado também é "repetido": importar a mesma planilha duas
  // vezes não pode dobrar os lotes.
  const known = new Set(existing.map((item) => `${item.productId}|${item.expiryDate}`))
  const seen = new Set<string>()

  const counts: Record<ExpiryRowStatus, number> = { novo: 0, existente: 0, duplicado: 0, invalido: 0 }

  const rows = sheet.rows.map((cells, index): PlannedLot => {
    const lineNumber = index + 2 // +1 pelo cabeçalho, +1 porque o Excel conta de 1
    const sku = mapping.sku >= 0 ? cellToText(cells[mapping.sku]) : ''
    const barcode = mapping.barcode >= 0 ? digitsOnly(cellToText(cells[mapping.barcode])) : ''
    const label = sku || barcode
    const rawDate = cells[mapping.expiryDate]
    const expiryDate = parseDate(typeof rawDate === 'string' ? rawDate : cellToText(rawDate))

    const base = { lineNumber, label }
    const planned = (status: ExpiryRowStatus, extra: Partial<PlannedLot> = {}): PlannedLot => {
      counts[status]++
      return { ...base, status, ...extra }
    }

    if (!label) return planned('invalido', { reason: 'Sem SKU nem código de barras' })

    const product = (sku ? bySku.get(sku) : undefined) ?? (barcode ? byBarcode.get(barcode) : undefined)
    if (!product) return planned('invalido', { reason: 'Produto não cadastrado' })

    if (!cellToText(rawDate)) return planned('invalido', { reason: 'Sem validade' })
    if (!expiryDate) return planned('invalido', { reason: 'Validade ilegível' })

    const key = `${product.id}|${expiryDate}`
    const extra = { productId: product.id, expiryDate }
    if (known.has(key)) return planned('existente', { ...extra, reason: 'Esse lote já existe' })
    if (seen.has(key)) return planned('duplicado', { ...extra, reason: 'Repetida na planilha' })

    seen.add(key)
    return planned('novo', { ...extra, reason: 'Lote novo' })
  })

  return { rows, counts }
}
