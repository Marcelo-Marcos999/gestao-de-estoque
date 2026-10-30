/**
 * Transforma as linhas da planilha de quebra num plano, antes de gravar
 * qualquer coisa.
 *
 * Três decisões que a revisão deixa visíveis:
 *
 * - **Produto fora do cadastro** vira registro de produto *pendente* (como no
 *   registro manual): a quebra existe, e o administrador completa o cadastro
 *   depois. Só é recusada a linha que não diz de qual produto se trata.
 * - **Motivo e origem** são casados pelo nome, sem ligar para caixa e acento.
 *   Nome que a lista ainda não tem **será criado** (uma base antiga tem as
 *   próprias categorias); linha sem nome usa o padrão escolhido na revisão —
 *   e, sem padrão, fica de fora, porque motivo e origem são obrigatórios.
 * - **Linha já importada** não entra de novo: importar o mesmo arquivo duas
 *   vezes não pode dobrar as perdas.
 */
import { cellToNumber, cellToText, digitsOnly } from '@/shared/lib/cell'
import { parseDate, type IsoDate } from '@/shared/lib/date'
import type { SheetData } from '@/shared/lib/spreadsheet'
import { normalizeHeader, type ColumnMapping } from '@/shared/import/fields'
import type { Product } from '@/features/products'
import type { LossRecord, Tag } from '../types'
import type { BreakageImportField } from './columns'

export type BreakageRowStatus = 'novo' | 'pendente' | 'existente' | 'duplicado' | 'invalido'

/** Motivo ou origem de uma linha: um id que já existe, ou um nome a criar. */
export interface TagRef {
  id?: string
  newLabel?: string
}

export interface BreakageImportOptions {
  defaultReasonId: string
  defaultOriginId: string
}

export const NO_DEFAULTS: BreakageImportOptions = { defaultReasonId: '', defaultOriginId: '' }

export interface PlannedLoss {
  lineNumber: number
  status: BreakageRowStatus
  label: string
  reason?: string
  /** Só nas linhas que entram: o que será gravado. */
  data?: {
    productId: string
    sku: string
    description: string
    barcode: string
    pendingProduct: boolean
    expiryDate: IsoDate | null
    quantity: number
    note: string
    reasonRef: TagRef
    originRef: TagRef
  }
}

export interface BreakageImportPlan {
  rows: PlannedLoss[]
  counts: Record<BreakageRowStatus, number>
  /** Linhas recusadas só por falta de motivo / de origem: se escolher um padrão, elas entram. */
  missingReason: number
  missingOrigin: number
  /** Nomes que não existem na lista e serão criados (sem repetir). */
  newReasons: string[]
  newOrigins: string[]
  reasons: Tag[]
  origins: Tag[]
}

export const BREAKAGE_NEEDS = 'Escolha a coluna de quantidade.'

interface Lookups {
  tags: Map<string, string>
  fresh: Map<string, string>
}

/** Casa o texto da célula com a lista; nome desconhecido vira "a criar", sem repetir ("Vencido" e "vencido" são um só). */
function resolveTag(text: string, fallbackId: string, lookups: Lookups): TagRef | null {
  const key = normalizeHeader(text)
  if (!key) return fallbackId ? { id: fallbackId } : null

  const known = lookups.tags.get(key)
  if (known) return { id: known }

  if (!lookups.fresh.has(key)) lookups.fresh.set(key, text)
  return { newLabel: lookups.fresh.get(key) }
}

function lookupsOf(tags: Tag[]): Lookups {
  return { tags: new Map(tags.map((t) => [normalizeHeader(t.label), t.id])), fresh: new Map() }
}

export function buildBreakagePlan(
  sheet: SheetData,
  mapping: ColumnMapping<BreakageImportField>,
  products: Product[],
  reasons: Tag[],
  origins: Tag[],
  existing: LossRecord[],
  options: BreakageImportOptions,
): BreakageImportPlan {
  const bySku = new Map(products.map((p) => [p.sku, p]))
  const byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode, p]))
  const reasonLookups = lookupsOf(reasons)
  const originLookups = lookupsOf(origins)

  // Identidade de um registro: produto + validade + motivo + origem + quantidade.
  const keyOf = (who: string, date: IsoDate | null, reason: string, origin: string, qty: number) =>
    [who, date ?? '', reason, origin, qty].join('|')
  const known = new Set(
    existing.map((r) => keyOf(r.productId || r.barcode, r.expiryDate, r.reasonId, r.originId, r.quantity)),
  )
  const seen = new Set<string>()

  const counts: Record<BreakageRowStatus, number> = { novo: 0, pendente: 0, existente: 0, duplicado: 0, invalido: 0 }
  let missingReason = 0
  let missingOrigin = 0

  const text = (cells: SheetData['rows'][number], field: BreakageImportField) =>
    mapping[field] >= 0 ? cellToText(cells[mapping[field]]) : ''

  const rows = sheet.rows.map((cells, index): PlannedLoss => {
    const lineNumber = index + 2 // +1 pelo cabeçalho, +1 porque o Excel conta de 1
    const sku = text(cells, 'sku')
    const barcode = digitsOnly(text(cells, 'barcode'))
    const description = text(cells, 'description')
    const label = sku || barcode || description

    const planned = (status: BreakageRowStatus, reason?: string, data?: PlannedLoss['data']): PlannedLoss => {
      counts[status]++
      return { lineNumber, status, label, reason, data }
    }

    if (!label) return planned('invalido', 'Sem produto (SKU, código de barras ou descrição)')

    const quantity = Math.round(cellToNumber(cells[mapping.quantity]) ?? 0)
    if (quantity < 1) return planned('invalido', 'Quantidade inválida')

    const rawDate = text(cells, 'expiryDate')
    const expiryDate = rawDate ? parseDate(rawDate) : null
    if (rawDate && !expiryDate) return planned('invalido', 'Validade ilegível')

    const reasonRef = resolveTag(text(cells, 'reason'), options.defaultReasonId, reasonLookups)
    const originRef = resolveTag(text(cells, 'origin'), options.defaultOriginId, originLookups)
    if (!reasonRef || !originRef) {
      if (!reasonRef) missingReason++
      if (!originRef) missingOrigin++
      return planned('invalido', !reasonRef ? 'Sem motivo' : 'Sem origem')
    }

    const product = (sku ? bySku.get(sku) : undefined) ?? (barcode ? byBarcode.get(barcode) : undefined)
    const data: NonNullable<PlannedLoss['data']> = {
      productId: product?.id ?? '',
      sku: product?.sku ?? sku,
      description: product?.description ?? description,
      barcode: product?.barcode ?? barcode,
      pendingProduct: !product,
      expiryDate,
      quantity,
      note: text(cells, 'note'),
      reasonRef,
      originRef,
    }

    // Só dá para comparar com o que já existe quando motivo e origem já têm id;
    // um nome a criar, por definição, ainda não tem registro nenhum.
    const who = data.productId || data.barcode || data.sku
    const key = keyOf(who, expiryDate, reasonRef.id ?? `+${reasonRef.newLabel}`, originRef.id ?? `+${originRef.newLabel}`, quantity)
    if (known.has(key)) return planned('existente', 'Esse registro já existe', data)
    if (seen.has(key)) return planned('duplicado', 'Linha repetida na planilha', data)

    seen.add(key)
    return product
      ? planned('novo', 'Produto cadastrado', data)
      : planned('pendente', 'Produto fora do cadastro: entra como pendente', data)
  })

  // Só os nomes de linhas que de fato entram: uma linha recusada por outro
  // motivo não pode deixar um motivo criado na lista sem nenhum registro.
  const entering = rows.filter((r) => r.status === 'novo' || r.status === 'pendente')
  const labelsOf = (pick: (d: NonNullable<PlannedLoss['data']>) => TagRef) =>
    [...new Set(entering.map((r) => pick(r.data!).newLabel).filter((l): l is string => !!l))]

  return {
    rows,
    counts,
    missingReason,
    missingOrigin,
    newReasons: labelsOf((d) => d.reasonRef),
    newOrigins: labelsOf((d) => d.originRef),
    reasons,
    origins,
  }
}
