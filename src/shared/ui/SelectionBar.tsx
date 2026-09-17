import { Button } from './Button'
import { CloseIcon, TrashIcon } from './icons'
import styles from './SelectionBar.module.css'

interface SelectionBarProps {
  selected: number
  total: number
  onSelectAll: () => void
  onClear: () => void
  onDelete: () => void
  /** Ação extra opcional, à esquerda de "Excluir" — usada por Validades para enviar lotes vencidos direto para a quebra. */
  extraAction?: { label: string; icon: React.ReactNode; onClick: () => void }
}

/**
 * Barra da seleção múltipla.
 *
 * Só existe quando há algo marcado. Uma barra permanente ocuparia altura da
 * lista o tempo todo por uma ação que é exceção — no celular isso custa um
 * cartão inteiro de leitura.
 */
export function SelectionBar({
  selected,
  total,
  onSelectAll,
  onClear,
  onDelete,
  extraAction,
}: SelectionBarProps) {
  if (selected === 0) return null

  return (
    <div className={styles.bar} role="status">
      <span className={styles.count}>
        {selected.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}{' '}
        {total === 1 ? 'selecionado' : 'selecionados'}
      </span>

      {selected < total && (
        <Button variant="secondary" onClick={onSelectAll}>
          Selecionar todos
        </Button>
      )}

      {extraAction && (
        <Button variant="secondary" onClick={extraAction.onClick}>
          {extraAction.icon}
          <span>{extraAction.label}</span>
        </Button>
      )}

      <Button variant="danger" onClick={onDelete}>
        <TrashIcon width={16} height={16} />
        <span>Excluir</span>
      </Button>

      <button type="button" className={styles.close} onClick={onClear} aria-label="Limpar seleção">
        <CloseIcon width={16} height={16} />
      </button>
    </div>
  )
}
