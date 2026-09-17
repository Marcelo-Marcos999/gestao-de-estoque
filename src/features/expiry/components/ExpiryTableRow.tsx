import { BoltIcon, EditIcon, TrashIcon } from '@/shared/ui/icons'
import { formatDate } from '@/shared/lib/date'
import { SITUATIONS } from '../situation'
import type { ExpiryRow } from '../types'
import { SituationBadge } from './SituationBadge'
import styles from './ExpiryTable.module.css'

interface ExpiryTableRowProps {
  row: ExpiryRow
  selected: boolean
  onToggleSelect: (id: string) => void
  onEdit: (row: ExpiryRow) => void
  onDelete: (row: ExpiryRow) => void
  onGenerateBreakage: (row: ExpiryRow) => void
}

/** "em 212 dias", "venceu há 149 dias" — o número cru não diz o que significa. */
function remainingLabel(days: number | null): { text: string; overdue: boolean } | null {
  if (days === null) return null
  if (days < 0) return { text: `venceu há ${Math.abs(days)} dias`, overdue: true }
  if (days === 0) return { text: 'vence hoje', overdue: true }
  if (days === 1) return { text: 'vence amanhã', overdue: false }
  return { text: `em ${days} dias`, overdue: false }
}

/** Uma linha da lista de lotes — separada de `ExpiryTable` só para não passar de ~200 linhas ali. */
export function ExpiryTableRow({
  row,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onGenerateBreakage,
}: ExpiryTableRowProps) {
  const remaining = remainingLabel(row.daysToExpiry)
  const token = SITUATIONS[row.situation].token

  return (
    <div
      className={`${styles.itemInner} ${selected ? styles.selected : ''}`}
      style={{ '--situation': `var(--situation-${token})` } as React.CSSProperties}
    >
      <span className={styles.stripe} />

      <label className={styles.select}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={selected}
          onChange={() => onToggleSelect(row.id)}
        />
        <span className={styles.srOnly}>Selecionar {row.description}</span>
      </label>

      <span className={styles.product}>
        <span className={styles.description} title={row.description}>
          {row.description}
        </span>
        <span className={styles.codes}>
          SKU {row.sku}
          {row.barcode && ` · ${row.barcode}`}
        </span>
      </span>

      {row.expiryDate ? (
        <span className={styles.expiry}>
          <span className={styles.date}>{formatDate(row.expiryDate)}</span>
          {remaining && (
            <span className={`${styles.remaining} ${remaining.overdue ? styles.overdue : ''}`}>
              {remaining.text}
            </span>
          )}
        </span>
      ) : (
        <span className={styles.absent}>sem data</span>
      )}

      <span className={styles.number}>{row.stock}</span>

      {row.daysToZero === null ? (
        <span className={styles.absent}>sem saídas</span>
      ) : (
        <span className={styles.number}>{row.daysToZero} dias</span>
      )}

      {/* No celular os mesmos dados voltam com rótulo, porque ali não existe
          cabeçalho de coluna para dizer o que é o quê. */}
      <span className={styles.mobileData}>
        <span>
          <span className={styles.mobileLabel}>{remaining?.overdue ? 'Venceu ' : 'Vence '}</span>
          <span className={styles.mobileValue}>
            {row.expiryDate ? formatDate(row.expiryDate) : '—'}
          </span>
        </span>
        <span>
          <span className={styles.mobileLabel}>Estoque </span>
          <span className={styles.mobileValue}>{row.stock}</span>
        </span>
        <span>
          <span className={styles.mobileLabel}>Sai em </span>
          <span className={styles.mobileValue}>
            {row.daysToZero === null ? '—' : `${row.daysToZero} dias`}
          </span>
        </span>
      </span>

      <span className={styles.situation}>
        <SituationBadge situation={row.situation} />
      </span>

      {/* No celular a linha vira cartão e estes botões ficam na área da
          situação, ao lado da faixa — o mesmo lugar em que o cadastro de
          produtos põe o seu. */}
      <span className={styles.actions}>
        {/* Só em lotes vencidos: gerar quebra de uma situação que já vai bem,
            ou sem estimativa, não faz sentido — nada venceu ainda. */}
        {row.situation === 'venceu' && (
          <button
            type="button"
            className={styles.action}
            onClick={() => onGenerateBreakage(row)}
            aria-label={`Gerar quebra de ${row.description}`}
            title="Gerar quebra"
          >
            <BoltIcon width={16} height={16} />
          </button>
        )}

        <button
          type="button"
          className={styles.action}
          onClick={() => onEdit(row)}
          aria-label={`Editar lote de ${row.description}`}
        >
          <EditIcon width={16} height={16} />
        </button>

        <button
          type="button"
          className={`${styles.action} ${styles.delete}`}
          onClick={() => onDelete(row)}
          aria-label={`Excluir lote de ${row.description}`}
        >
          <TrashIcon width={16} height={16} />
        </button>
      </span>
    </div>
  )
}
