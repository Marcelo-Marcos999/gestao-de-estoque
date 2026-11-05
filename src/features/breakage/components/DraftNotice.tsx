import { Alert } from '@/shared/ui/Alert'
import styles from './DraftNotice.module.css'

/** Avisa que o formulário voltou com o que estava preenchido, e deixa recomeçar do zero. */
export function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <Alert tone="info">
      Retomamos o registro que você estava preenchendo.{' '}
      <button type="button" className={styles.discard} onClick={onDiscard}>
        Começar de novo
      </button>
    </Alert>
  )
}
