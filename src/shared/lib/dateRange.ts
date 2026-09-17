/**
 * Filtro de período: data "de" e/ou "até", cada uma opcional.
 *
 * Comparação por texto funciona porque `IsoDate` é sempre `AAAA-MM-DD` (ver
 * `shared/lib/date.ts`) — nessa ordem, comparar como string dá o mesmo
 * resultado que comparar como data.
 */
import type { IsoDate } from './date'

export interface DateRange {
  from: IsoDate | null
  to: IsoDate | null
}

export const EMPTY_DATE_RANGE: DateRange = { from: null, to: null }

export function isDateRangeActive(range: DateRange): boolean {
  return range.from !== null || range.to !== null
}

/** Texto estável para compor a chave de uma busca — dispara refetch quando muda. */
export function dateRangeKey(range: DateRange): string {
  return `${range.from ?? ''}~${range.to ?? ''}`
}

/**
 * Uma linha sem data cadastrada nunca cai dentro de um período: filtrar por
 * "vence entre X e Y" pergunta sobre uma data que ela não tem, então ela sai
 * da lista em vez de aparecer como se coincidisse com o período.
 */
export function matchesDateRange(value: IsoDate | null, range: DateRange): boolean {
  if (!isDateRangeActive(range)) return true
  if (value === null) return false
  if (range.from !== null && value < range.from) return false
  if (range.to !== null && value > range.to) return false
  return true
}

export function isDateRange(value: unknown): value is DateRange {
  if (typeof value !== 'object' || value === null) return false
  const { from, to } = value as Record<string, unknown>
  return (from === null || typeof from === 'string') && (to === null || typeof to === 'string')
}

/** Frase pronta para o aviso de filtro ativo: "vence entre 01/10 e 15/10"... */
export function describeDateRange(label: string, range: DateRange): string | null {
  if (!isDateRangeActive(range)) return null

  const fmt = (iso: IsoDate) => {
    const [ano, mes, dia] = iso.split('-')
    return `${dia}/${mes}/${ano}`
  }

  if (range.from !== null && range.to !== null) {
    return `${label} entre ${fmt(range.from)} e ${fmt(range.to)}`
  }
  if (range.from !== null) return `${label} a partir de ${fmt(range.from)}`
  return `${label} até ${fmt(range.to as IsoDate)}`
}
