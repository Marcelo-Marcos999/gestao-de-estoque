/**
 * O que cada coluna ordenável da tabela de Validades compara.
 *
 * Sem data ou sem saídas viram string/número vazios em vez de erro: assim a
 * linha some para o fim ao ordenar crescente, sem precisar de um caso
 * especial em cada coluna que chama isto.
 */
import { SITUATION_ORDER } from './situation'
import type { ExpirySortKey } from './components/ExpiryTable'
import type { ExpiryRow } from './types'

export function expiryValueOf(row: ExpiryRow, key: ExpirySortKey): string | number {
  switch (key) {
    case 'description':
      return row.description
    case 'expiryDate':
      return row.expiryDate ?? ''
    case 'stock':
      return row.stock
    case 'daysToZero':
      return row.daysToZero ?? Number.POSITIVE_INFINITY
    case 'situation':
      return SITUATION_ORDER.indexOf(row.situation)
  }
}
