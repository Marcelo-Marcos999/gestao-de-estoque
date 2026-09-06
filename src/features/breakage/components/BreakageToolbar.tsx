import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'
import { FocusToggle } from '@/shared/ui/FocusToggle'
import { ScanButton } from '@/shared/ui/ScanButton'
import { SearchIcon } from '@/shared/ui/icons'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import type { LossRecordQuery } from '../types'
import styles from './BreakageToolbar.module.css'

const ABAS: { value: LossRecordQuery['stockState']; label: string }[] = [
  { value: 'no-estoque', label: 'No estoque' },
  { value: 'zerados', label: 'Zerados' },
  { value: 'todos', label: 'Todos' },
]

interface BreakageToolbarProps {
  filters: LossRecordQuery
  /** Quantos registros o filtro atual está mostrando. */
  matching: number
  isFiltered: boolean
  focused: boolean
  /** Falso no celular, onde a página inteira já rola e não há o que esconder. */
  focusAvailable: boolean
  /** Ações do cabeçalho, que migram para cá quando ele sai no modo foco. */
  actions: ReactNode
  onSearch: (search: string) => void
  onStockState: (state: LossRecordQuery['stockState']) => void
  onClear: () => void
  onToggleFocus: () => void
}

/**
 * Busca, abas e o aviso do filtro ativo.
 *
 * O aviso não é enfeite: os filtros são restaurados do `localStorage` ao abrir
 * o app, e uma lista filtrada que parece a lista inteira engana. Ele mostra o
 * que está ativo e oferece o caminho de volta (ver CLAUDE.md).
 */
export function BreakageToolbar({
  filters,
  matching,
  isFiltered,
  focused,
  focusAvailable,
  actions,
  onSearch,
  onStockState,
  onClear,
  onToggleFocus,
}: BreakageToolbarProps) {
  const isNarrow = useMediaQuery('(max-width: 719px)')

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            className={styles.input}
            type="search"
            value={filters.search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={
              isNarrow ? 'Buscar produto' : 'Buscar por descrição, SKU ou código de barras'
            }
            aria-label="Buscar registros"
            autoComplete="off"
          />

          {/* A busca aceita o código lido, não só o digitado: no corredor a
              etiqueta está na mão e o teclado do celular não. */}
          <ScanButton onDetect={onSearch} label="Buscar por código de barras" />
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Situação do saldo">
          {ABAS.map((aba) => (
            <button
              key={aba.value}
              type="button"
              role="tab"
              aria-selected={filters.stockState === aba.value}
              className={`${styles.tab} ${
                filters.stockState === aba.value ? styles.tabActive : ''
              }`}
              onClick={() => onStockState(aba.value)}
            >
              {aba.label}
            </button>
          ))}
        </div>

        {actions && <div className={styles.actions}>{actions}</div>}

        <FocusToggle focused={focused} available={focusAvailable} onToggle={onToggleFocus} />
      </div>

      {isFiltered && (
        <div className={styles.active} role="status">
          <SearchIcon className={styles.activeIcon} width={16} height={16} />
          <span className={styles.activeText}>
            Mostrando {matching.toLocaleString('pt-BR')}{' '}
            {matching === 1 ? 'registro' : 'registros'}
            {filters.stockState !== 'todos' && (
              <> {filters.stockState === 'zerados' ? 'com saldo zerado' : 'no estoque'}</>
            )}
            {filters.search.trim() && (
              <>
                {' '}
                para <span className={styles.term}>“{filters.search.trim()}”</span>
              </>
            )}
            .
          </span>
          <Button variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}
    </>
  )
}
