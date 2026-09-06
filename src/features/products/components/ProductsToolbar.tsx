import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'
import { FocusToggle } from '@/shared/ui/FocusToggle'
import { ScanButton } from '@/shared/ui/ScanButton'
import { SearchIcon } from '@/shared/ui/icons'
import type { ProductQuery } from '../types'
import styles from './ProductsToolbar.module.css'

interface ProductsToolbarProps {
  filters: ProductQuery
  isFiltered: boolean
  /** Quantos produtos atendem ao filtro no momento. */
  matching: number
  narrow: boolean
  focused: boolean
  /** Falso no celular, onde a página inteira já rola e não há o que esconder. */
  focusAvailable: boolean
  /** Ações do cabeçalho, que migram para cá quando ele sai no modo foco. */
  actions: ReactNode
  onSearch: (value: string) => void
  onToggleWithoutBarcode: (value: boolean) => void
  onClear: () => void
  onToggleFocus: () => void
}

export function ProductsToolbar({
  filters,
  isFiltered,
  matching,
  narrow,
  focused,
  focusAvailable,
  actions,
  onSearch,
  onToggleWithoutBarcode,
  onClear,
  onToggleFocus,
}: ProductsToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <SearchIcon className={styles.searchIcon} width={18} height={18} />
        <input
          className={styles.input}
          type="search"
          value={filters.search}
          onChange={(event) => onSearch(event.target.value)}
          // O texto longo aparece cortado em tela estreita; o rótulo acessível
          // continua completo para quem usa leitor de tela.
          placeholder={narrow ? 'Buscar produto' : 'Buscar por descrição, SKU ou código de barras'}
          aria-label="Buscar produtos"
          autoComplete="off"
        />

        {/* A busca aceita o código lido, não só o digitado: no corredor a
            etiqueta está na mão e o teclado do celular não. */}
        <ScanButton onDetect={onSearch} label="Buscar por código de barras" />
      </div>

      <label className={`${styles.filter} ${filters.onlyWithoutBarcode ? styles.filterOn : ''}`}>
        <input
          type="checkbox"
          checked={filters.onlyWithoutBarcode}
          onChange={(event) => onToggleWithoutBarcode(event.target.checked)}
        />
        Só sem código de barras
      </label>

      {actions && <div className={styles.actions}>{actions}</div>}

      <FocusToggle focused={focused} available={focusAvailable} onToggle={onToggleFocus} />

      {isFiltered && (
        <div className={styles.active} role="status">
          <SearchIcon className={styles.activeIcon} width={16} height={16} />

          <span className={styles.activeText}>
            Mostrando {matching.toLocaleString('pt-BR')}{' '}
            {matching === 1 ? 'produto' : 'produtos'}
            {filters.search.trim() && (
              <>
                {' '}
                para <span className={styles.term}>“{filters.search.trim()}”</span>
              </>
            )}
            {filters.onlyWithoutBarcode && <> sem código de barras</>}.
          </span>

          <Button variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
