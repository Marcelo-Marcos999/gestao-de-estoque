import type { DiscountType } from '../types'
import styles from './DiscountField.module.css'

interface DiscountFieldProps {
  type: DiscountType
  text: string
  onType: (type: DiscountType) => void
  onText: (text: string) => void
}

/**
 * Desconto no item: em % ou em R$, com o valor ao lado. Vazio é "sem desconto".
 * O valor fica em texto para aceitar a vírgula brasileira ("2,50") enquanto se digita.
 */
export function DiscountField({ type, text, onType, onText }: DiscountFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="order-discount">
        Desconto
      </label>
      <div className={styles.row}>
        <input
          id="order-discount"
          className={styles.input}
          type="text"
          inputMode="decimal"
          value={text}
          placeholder="0"
          onFocus={(event) => event.target.select()}
          onChange={(event) => onText(event.target.value)}
          autoComplete="off"
        />
        <div className={styles.segments} role="group" aria-label="Tipo de desconto">
          <button type="button" className={styles.segment} aria-pressed={type === 'percent'} onClick={() => onType('percent')}>
            %
          </button>
          <button type="button" className={styles.segment} aria-pressed={type === 'amount'} onClick={() => onType('amount')}>
            R$
          </button>
        </div>
      </div>
    </div>
  )
}
