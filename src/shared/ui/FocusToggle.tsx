import { CollapseIcon, ExpandIcon } from './icons'
import styles from './FocusToggle.module.css'

interface FocusToggleProps {
  focused: boolean
  /** Falso no celular, onde a página inteira já rola e não há o que esconder. */
  available: boolean
  onToggle: () => void
}

/**
 * Liga e desliga o modo foco: o cabeçalho da página sai, a barra lateral
 * recolhe e a lista fica com a altura toda.
 *
 * Fica na barra de busca, e não no cabeçalho, porque o cabeçalho é justamente
 * o que desaparece — um botão que some junto com o que ele escondeu não teria
 * como ser desfeito.
 */
export function FocusToggle({ focused, available, onToggle }: FocusToggleProps) {
  if (!available) return null

  const rotulo = focused ? 'Mostrar cabeçalho (Esc)' : 'Expandir lista'
  const Icon = focused ? CollapseIcon : ExpandIcon

  return (
    <button
      type="button"
      className={`${styles.toggle} ${focused ? styles.active : ''}`}
      onClick={onToggle}
      aria-pressed={focused}
      aria-label={rotulo}
      title={rotulo}
    >
      <Icon width={18} height={18} />
    </button>
  )
}
