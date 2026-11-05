import { formatMoney } from '@/shared/lib/money'
import { Button } from '@/shared/ui/Button'
import { orderTotals } from '../compute'
import { formatWhen } from '../format'
import type { Order } from '../types'
import styles from './OrderTotals.module.css'

/**
 * A conta do pedido: itens, subtotal, descontos e (se pedido) custo e lucro. Fica no
 * fluxo da página, logo depois da lista — o que fica sempre à vista é só a barra de
 * ação abaixo, para o total e o botão de fechar não tomarem a tela do celular.
 */
export function OrderSummary({ order, showCost }: { order: Order; showCost: boolean }) {
  const totals = orderTotals(order)

  return (
    <dl className={styles.summary} aria-label="Resumo do pedido">
      <div className={styles.row}>
        <dt>Itens</dt>
        <dd>
          {order.itemCount} · {order.unitCount.toLocaleString('pt-BR')} un
        </dd>
      </div>
      <div className={styles.row}>
        <dt>Subtotal</dt>
        <dd>{formatMoney(totals.subtotal)}</dd>
      </div>
      <div className={styles.row}>
        <dt>Descontos</dt>
        <dd>{totals.discounts > 0 ? `−${formatMoney(totals.discounts)}` : formatMoney(0)}</dd>
      </div>
      {showCost && (
        <>
          <div className={styles.row}>
            <dt>Custo</dt>
            <dd>{formatMoney(order.cost)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Lucro</dt>
            <dd>
              {formatMoney(totals.profit)} ({totals.marginPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
            </dd>
          </div>
        </>
      )}
    </dl>
  )
}

interface OrderActionBarProps {
  order: Order
  busy: boolean
  onClose: () => void
  onReopen: () => void
}

/**
 * Total e ação que muda o estado (fechar ou reabrir), colados no rodapé da tela
 * enquanto a lista rola: com dezenas de itens, o total e o botão continuam à mão.
 */
export function OrderActionBar({ order, busy, onClose, onReopen }: OrderActionBarProps) {
  const open = order.status === 'open'

  return (
    <section className={styles.bar} aria-label="Total do pedido">
      <div className={styles.total}>
        <span className={styles.label}>{open ? 'Total do pedido' : 'Total a pagar'}</span>
        <span className={styles.value}>{formatMoney(order.total)}</span>
        {!open && order.closedAt && <span className={styles.closedAt}>Fechado em {formatWhen(order.closedAt)}</span>}
      </div>

      {open ? (
        <Button loading={busy} disabled={order.itemCount === 0} onClick={onClose}>
          Fechar pedido
        </Button>
      ) : (
        <Button variant="secondary" loading={busy} onClick={onReopen}>
          Reabrir para editar
        </Button>
      )}
    </section>
  )
}
