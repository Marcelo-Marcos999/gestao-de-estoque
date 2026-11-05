import styles from './LossRecordDialog.module.css'

/** Quantos dias faltam (ou passaram) da validade digitada, por escrito: nunca só cor. */
export function ExpiryRemaining({ days }: { days: number | null }) {
  if (days === null) return null

  return (
    <span className={`${styles.remaining} ${days < 0 ? styles.overdue : ''}`}>
      {days < 0 ? `venceu há ${Math.abs(days)} dias` : days === 0 ? 'vence hoje' : `vence em ${days} dias`}
    </span>
  )
}
