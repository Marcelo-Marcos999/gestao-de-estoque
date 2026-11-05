import { formatMoney } from '@/shared/lib/money'
import { EditIcon, TrashIcon } from '@/shared/ui/icons'
import { discountLabel } from '../compute'
import type { OrderLine } from '../types'
import styles from './OrderLines.module.css'

interface OrderLinesProps {
  lines: OrderLine[]
  /** Pedido aberto: mostra editar e excluir. Fechado: só leitura. */
  editable: boolean
  showCost: boolean
  onEdit: (line: OrderLine) => void
  onRemove: (line: OrderLine) => void
}

/**
 * Os itens do pedido, um cartão por linha — cabem do mesmo jeito no celular e no
 * computador, e o que importa (produto, conta e total) fica sempre à vista.
 */
export function OrderLines({ lines, editable, showCost, onEdit, onRemove }: OrderLinesProps) {
  return (
    <ul className={styles.list}>
      {lines.map((line) => {
        const off = discountLabel(line.discount, formatMoney)
        const gross = Math.round(line.unitPrice * 100) * line.quantity / 100
        const profit = Math.round((line.total - line.cost) * 100) / 100

        return (
          <li className={styles.line} key={line.id}>
            <div className={styles.body}>
              <span className={styles.description}>{line.description}</span>
              <span className={styles.codes}>
                SKU {line.sku}
                {line.barcode && ` · ${line.barcode}`}
              </span>
              <span className={styles.math}>
                {line.quantity.toLocaleString('pt-BR')} × {formatMoney(line.unitPrice)}
                {off && <span className={styles.discount}>desconto {off}</span>}
              </span>
              {showCost && (
                <span className={styles.cost}>
                  Custo {formatMoney(line.unitCost)}/un · total {formatMoney(line.cost)} · lucro{' '}
                  {formatMoney(profit)}
                </span>
              )}
            </div>

            <div className={styles.amounts}>
              <span className={styles.total}>{formatMoney(line.total)}</span>
              {off && <span className={styles.gross}>{formatMoney(gross)}</span>}
            </div>

            {editable && (
              <div className={styles.actions}>
                <button type="button" className={styles.iconButton} onClick={() => onEdit(line)} aria-label={`Editar ${line.description}`}>
                  <EditIcon width={18} height={18} />
                </button>
                <button type="button" className={styles.iconButton} onClick={() => onRemove(line)} aria-label={`Excluir ${line.description}`}>
                  <TrashIcon width={18} height={18} />
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
