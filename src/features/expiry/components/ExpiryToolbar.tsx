import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'
import { FilterPanel } from '@/shared/ui/FilterPanel'
import { FocusToggle } from '@/shared/ui/FocusToggle'
import { ScanButton } from '@/shared/ui/ScanButton'
import { SearchIcon } from '@/shared/ui/icons'
import { describeDateRange, type DateRange } from '@/shared/lib/dateRange'
import { countActiveRanges, describeRange, type NumberRange } from '@/shared/lib/numberRange'
import { SITUATIONS } from '../situation'
import { EXPIRY_RANGE_FIELDS, type ExpiryQuery, type ExpiryRangeKey } from '../types'
import { PeriodField } from './PeriodField'
import styles from './ExpiryToolbar.module.css'

interface ExpiryToolbarProps {
  filters: ExpiryQuery
  isFiltered: boolean
  matching: number
  narrow: boolean
  focused: boolean
  focusAvailable: boolean
  actions: ReactNode
  periodDays: number
  onSearch: (value: string) => void
  onPeriodChange: (days: number) => void
  onExpiryRangeChange: (range: DateRange) => void
  onNumberRangeChange: (key: ExpiryRangeKey, range: NumberRange) => void
  onClearRanges: () => void
  onClear: () => void
  onToggleFocus: () => void
}

/**
 * Busca, período das saídas, painel de filtro e o aviso de filtro ativo.
 *
 * Separado da página como as demais telas com registro (`ProductsToolbar`,
 * `StockToolbar`, `BreakageToolbar`) — o mesmo corte por comportamento.
 */
export function ExpiryToolbar({
  filters,
  isFiltered,
  matching,
  narrow,
  focused,
  focusAvailable,
  actions,
  periodDays,
  onSearch,
  onPeriodChange,
  onExpiryRangeChange,
  onNumberRangeChange,
  onClearRanges,
  onClear,
  onToggleFocus,
}: ExpiryToolbarProps) {
  const rangeTexts = [
    describeDateRange('Validade', filters.expiryRange),
    ...EXPIRY_RANGE_FIELDS.map((field) => describeRange(field.label, filters.numberRanges[field.key])),
  ].filter((text): text is string => text !== null)

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
            placeholder={narrow ? 'Buscar produto' : 'Buscar por descrição, SKU ou código de barras'}
            aria-label="Buscar lotes"
            autoComplete="off"
          />

          {/* A busca aceita o código lido, não só o digitado: no corredor a
              etiqueta está na mão e o teclado do celular não. */}
          <ScanButton onDetect={onSearch} label="Buscar por código de barras" />
        </div>

        {/* O número que sustenta a previsão fica visível e editável aqui: sem
            ele, "sai em 195 dias" é um número sem procedência — e quem lê a
            previsão é quem percebe que o intervalo está errado. */}
        <PeriodField days={periodDays} onChange={onPeriodChange} />

        <FilterPanel
          dateLabel="Validade"
          dateValue={filters.expiryRange}
          onDateChange={onExpiryRangeChange}
          numberFields={EXPIRY_RANGE_FIELDS}
          numberValues={filters.numberRanges}
          onNumberChange={(key, range) => onNumberRangeChange(key as ExpiryRangeKey, range)}
          activeCount={
            countActiveRanges(filters.numberRanges) +
            (filters.expiryRange.from !== null || filters.expiryRange.to !== null ? 1 : 0)
          }
          onClear={onClearRanges}
        />

        {actions && <div className={styles.actions}>{actions}</div>}

        <FocusToggle focused={focused} available={focusAvailable} onToggle={onToggleFocus} />
      </div>

      {isFiltered && (
        <div className={styles.active} role="status">
          <SearchIcon className={styles.activeIcon} width={16} height={16} />
          <span className={styles.activeText}>
            Mostrando {matching.toLocaleString('pt-BR')} {matching === 1 ? 'lote' : 'lotes'}
            {filters.situations.length > 0 && (
              <>
                {' '}
                em {filters.situations.map((s) => SITUATIONS[s].label.toLowerCase()).join(', ')}
              </>
            )}
            {filters.search.trim() && (
              <>
                {' '}
                para <span className={styles.term}>“{filters.search.trim()}”</span>
              </>
            )}
            {rangeTexts.length > 0 && <> com {rangeTexts.join(', ')}</>}.
          </span>
          <Button variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}
    </>
  )
}
