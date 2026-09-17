/**
 * Formato e valor padrão do filtro da tela de quebra — separado do hook só
 * para não passar de ~200 linhas ali (ver CLAUDE.md).
 */
import { isRangesRecord } from '@/shared/lib/numberRange'
import { EMPTY_LOSS_RECORD_RANGES, LOSS_RECORD_RANGE_FIELDS, type LossRecordQuery } from './types'

export const RANGE_KEYS = LOSS_RECORD_RANGE_FIELDS.map((field) => field.key)

export const NO_FILTERS: LossRecordQuery = {
  search: '',
  stockState: 'no-estoque',
  reasonIds: [],
  originIds: [],
  numberRanges: EMPTY_LOSS_RECORD_RANGES,
}

const STOCK_STATES: LossRecordQuery['stockState'][] = ['todos', 'no-estoque', 'zerados']

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

/** Descarta registro fora de formato em vez de deixar a tela num estado impossível. */
export function isLossRecordQuery(value: unknown): value is LossRecordQuery {
  if (typeof value !== 'object' || value === null) return false

  const { search, stockState, reasonIds, originIds, numberRanges } = value as Record<
    string,
    unknown
  >
  return (
    typeof search === 'string' &&
    STOCK_STATES.includes(stockState as LossRecordQuery['stockState']) &&
    isStringArray(reasonIds) &&
    isStringArray(originIds) &&
    isRangesRecord(numberRanges, RANGE_KEYS)
  )
}
