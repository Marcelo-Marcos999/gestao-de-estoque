import { Alert } from '@/shared/ui/Alert'
import { formatDate, type IsoDate } from '@/shared/lib/date'
import { labelOf } from '../tags'
import type { LossRecord, Tag } from '../types'

interface SameProductNoticeProps {
  /** Registros que a loja já tem do mesmo produto (do mais recente ao mais antigo). */
  existing: LossRecord[]
  reasons: Tag[]
}

/**
 * Avisa, logo que o produto é escolhido, que ele já tem registro de quebra nesta
 * loja. **Só informa**: a mesma mercadoria pode se perder de novo, e cada
 * ocorrência merece o seu registro.
 *
 * Fica ao lado do campo e não numa janela que interrompe. A janela de "registro
 * igual" (produto + validade + motivo) continua existindo no envio, porque aquela
 * pede uma decisão — somar ou criar outro. Este aviso só dá contexto, então não
 * pode custar um clique: aviso que interrompe sempre vira aviso que ninguém lê.
 */
export function SameProductNotice({ existing, reasons }: SameProductNoticeProps) {
  const latest = existing[0]
  if (!latest) return null

  const when = formatDate(latest.createdAt.slice(0, 10) as IsoDate)
  const units = latest.quantity === 1 ? 'unidade' : 'unidades'

  return (
    <Alert tone="info">
      Este produto já tem {existing.length === 1 ? '1 registro' : `${existing.length} registros`}{' '}
      de quebra nesta loja. O mais recente: {when}, {latest.quantity} {units}
      {latest.reasonId && `, ${labelOf(reasons, latest.reasonId)}`}. Pode registrar mesmo assim.
    </Alert>
  )
}
