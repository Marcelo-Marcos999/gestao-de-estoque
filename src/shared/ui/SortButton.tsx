import { SortAscIcon, SortDescIcon, SortIcon } from './icons'
import type { SortDir } from '@/shared/hooks/useSort'
import styles from './SortButton.module.css'

interface SortButtonProps<Key extends string> {
  label: string
  sortKey: Key
  /** Coluna ordenada agora, ou nenhuma. */
  activeKey: Key | null
  activeDir: SortDir | null
  onSort: (key: Key) => void
}

/**
 * Cabeçalho de coluna que ordena ao clicar — mesmo ciclo de `useSort`.
 *
 * Substitui o `<span>` estático do cabeçalho por um botão, mantendo a mesma
 * tipografia (o cabeçalho é quem define o estilo do texto, não este botão).
 * O ícone muda de neutro para seta única, e a seta some quando a coluna deixa
 * de estar ativa — cor nunca é o único sinal (ver CLAUDE.md).
 */
export function SortButton<Key extends string>({
  label,
  sortKey,
  activeKey,
  activeDir,
  onSort,
}: SortButtonProps<Key>) {
  const active = activeKey === sortKey

  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ''}`}
      onClick={() => onSort(sortKey)}
      aria-label={`Ordenar por ${label}`}
      title={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      {active && activeDir === 'asc' && <SortAscIcon width={13} height={13} />}
      {active && activeDir === 'desc' && <SortDescIcon width={13} height={13} />}
      {!active && <SortIcon className={styles.inactive} width={13} height={13} />}
    </button>
  )
}
