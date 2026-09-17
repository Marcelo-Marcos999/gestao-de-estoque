/**
 * O que cada coluna ordenável da tabela de Quebra compara.
 *
 * Motivo ordena pelo texto exibido, não pelo id — separado da página só para
 * não passar de ~200 linhas ali (mesmo padrão de `expiry/sort.ts`).
 */
import type { LossRecordSortKey } from './components/LossRecordTable'
import { labelOf } from './tags'
import type { LossRecord, Tag } from './types'

export function recordValueOf(record: LossRecord, key: LossRecordSortKey, reasons: Tag[]): string | number {
  switch (key) {
    case 'description':
      return record.description
    case 'expiryDate':
      return record.expiryDate ?? ''
    case 'quantity':
      return record.quantity
    case 'reason':
      return labelOf(reasons, record.reasonId)
  }
}
