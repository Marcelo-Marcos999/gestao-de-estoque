import { Link } from 'react-router-dom'
import { formatMoney } from '@/shared/lib/money'
import { ChevronRightIcon } from '@/shared/ui/icons'
import { formatWhen } from '../format'
import type { OrderSummary } from '../types'
import { OrderStatusBadge } from './OrderStatusBadge'
import styles from './OrderCard.module.css'

interface OrderCardProps {
  order: OrderSummary
  /** Só com mais de uma loja à vista: diz DE QUAL loja é o pedido. */
  showStore: boolean
}

/** Uma linha da lista de pedidos: o suficiente para reconhecer o pedido e abrir. */
export function OrderCard({ order, showStore }: OrderCardProps) {
  const items = `${order.itemCount} ${order.itemCount === 1 ? 'item' : 'itens'}`
  const units = `${order.unitCount} ${order.unitCount === 1 ? 'unidade' : 'unidades'}`

  return (
    <li>
      <Link className={styles.card} to={`/pedidos/${order.id}`}>
        <div className={styles.main}>
          <div className={styles.top}>
            <span className={styles.number}>PD {order.number}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <span className={styles.customer}>{order.customer}</span>
          <span className={styles.meta}>
            {order.itemCount === 0 ? 'Sem itens' : `${items} · ${units}`}
            {' · '}
            {formatWhen(order.createdAt)}
            {showStore && ` · ${order.storeName}`}
          </span>
        </div>

        <div className={styles.side}>
          <span className={styles.total}>{formatMoney(order.total)}</span>
          <ChevronRightIcon className={styles.chevron} width={18} height={18} />
        </div>
      </Link>
    </li>
  )
}
