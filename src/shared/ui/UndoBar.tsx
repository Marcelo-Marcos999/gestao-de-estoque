import { Button } from './Button'
import { CloseIcon, TrashIcon } from './icons'
import styles from './UndoBar.module.css'

interface UndoBarProps {
  /** Quantos itens foram excluídos. Zero não desenha nada. */
  count: number
  /** Como o item se chama quando é um só — "Registro de X", "Lote de Y". */
  label: string
  /** Plural para o texto de vários: "registros", "lotes". */
  plural: string
  onUndo: () => void
  onDismiss: () => void
}

/**
 * A contrapartida da exclusão sem confirmação.
 *
 * Fica fixa no rodapé porque a lista rola: um aviso no topo sumiria da tela
 * junto com o item excluído, e o desfazer só serve enquanto está à vista.
 */
export function UndoBar({ count, label, plural, onUndo, onDismiss }: UndoBarProps) {
  if (count === 0) return null

  return (
    <div className={styles.bar} role="status">
      <TrashIcon className={styles.icon} width={18} height={18} />
      <span className={styles.text}>
        {count === 1 ? (
          <>
            <strong>{label}</strong> excluído.
          </>
        ) : (
          <>
            <strong>
              {count} {plural}
            </strong>{' '}
            excluídos.
          </>
        )}
      </span>
      <Button variant="secondary" onClick={onUndo}>
        Desfazer
      </Button>
      <button type="button" className={styles.close} onClick={onDismiss} aria-label="Dispensar">
        <CloseIcon width={16} height={16} />
      </button>
    </div>
  )
}
