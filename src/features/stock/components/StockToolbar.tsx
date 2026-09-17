import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'
import { FilterPanel } from '@/shared/ui/FilterPanel'
import { FocusToggle } from '@/shared/ui/FocusToggle'
import { ScanButton } from '@/shared/ui/ScanButton'
import { SearchIcon } from '@/shared/ui/icons'
import { countActiveRanges, describeRange, type NumberRange } from '@/shared/lib/numberRange'
import { STOCK_RANGE_FIELDS, type StockQuery, type StockRangeKey } from '../types'
import styles from './StockToolbar.module.css'

interface StockToolbarProps {
  filters: StockQuery
  isFiltered: boolean
  matching: number
  narrow: boolean
  focused: boolean
  focusAvailable: boolean
  actions: ReactNode
  onSearch: (value: string) => void
  onTogglePending: (value: boolean) => void
  onRangeChange: (key: StockRangeKey, range: NumberRange) => void
  onClearRanges: () => void
  onClear: () => void
  onToggleFocus: () => void
}

export function StockToolbar({
  filters,
  isFiltered,
  matching,
  narrow,
  focused,
  focusAvailable,
  actions,
  onSearch,
  onTogglePending,
  onRangeChange,
  onClearRanges,
  onClear,
  onToggleFocus,
}: StockToolbarProps) {
  const rangeTexts = STOCK_RANGE_FIELDS.map((field) =>
    describeRange(field.label, filters.numberRanges[field.key]),
  ).filter((text): text is string => text !== null)
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <SearchIcon className={styles.searchIcon} width={18} height={18} />
        <input
          className={styles.input}
          type="search"
          value={filters.search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={narrow ? 'Buscar produto' : 'Buscar por descrição, SKU ou código de barras'}
          aria-label="Buscar produtos no estoque"
          autoComplete="off"
        />

        <ScanButton onDetect={onSearch} label="Buscar por código de barras" />
      </div>

      <label className={`${styles.filter} ${filters.onlyPending ? styles.filterOn : ''}`}>
        <input
          type="checkbox"
          checked={filters.onlyPending}
          onChange={(event) => onTogglePending(event.target.checked)}
        />
        Só pendentes
      </label>

      <FilterPanel
        numberFields={STOCK_RANGE_FIELDS}
        numberValues={filters.numberRanges}
        onNumberChange={(key, range) => onRangeChange(key as StockRangeKey, range)}
        activeCount={countActiveRanges(filters.numberRanges)}
        onClear={onClearRanges}
      />

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
            {filters.onlyPending && <> pendentes de cadastro</>}
            {rangeTexts.length > 0 && <> com {rangeTexts.join(', ')}</>}.
          </span>

          <Button variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
