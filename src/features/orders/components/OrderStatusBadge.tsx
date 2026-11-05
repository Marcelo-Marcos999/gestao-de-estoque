import { Badge } from '@/shared/ui/Badge'
import { CheckIcon } from '@/shared/ui/icons'
import type { OrderStatus } from '../types'

/** O estado é sempre texto (e o fechado leva o ✓): nunca só a cor. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return status === 'open' ? (
    <Badge tone="marca">Aberto</Badge>
  ) : (
    <Badge tone="neutro">
      <CheckIcon width={12} height={12} />
      Fechado
    </Badge>
  )
}
