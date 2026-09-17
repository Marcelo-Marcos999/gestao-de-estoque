import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'
import { FilterMenu } from '@/shared/ui/FilterMenu'
import { FilterPanel } from '@/shared/ui/FilterPanel'
import { FocusToggle } from '@/shared/ui/FocusToggle'
import { ScanButton } from '@/shared/ui/ScanButton'
import { SearchIcon } from '@/shared/ui/icons'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { countActiveRanges, describeRange, type NumberRange } from '@/shared/lib/numberRange'
import { LOSS_RECORD_RANGE_FIELDS, type LossRecordQuery, type LossRecordRangeKey, type Tag } from '../types'
import styles from './BreakageToolbar.module.css'

const ABAS: { value: LossRecordQuery['stockState']; label: string }[] = [
  { value: 'no-estoque', label: 'No estoque' },
  { value: 'zerados', label: 'Zerados' },
  { value: 'todos', label: 'Todos' },
]

interface BreakageToolbarProps {
  filters: LossRecordQuery
  reasons: Tag[]
  origins: Tag[]
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
  onToggleReason: (id: string) => void
  onToggleOrigin: (id: string) => void
  onClearReason: () => void
  onClearOrigin: () => void
  onRangeChange: (key: LossRecordRangeKey, range: NumberRange) => void
  onClearRanges: () => void
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
  reasons,
  origins,
  matching,
  isFiltered,
  focused,
  focusAvailable,
  actions,
  onSearch,
  onStockState,
  onToggleReason,
  onToggleOrigin,
  onClearReason,
  onClearOrigin,
  onRangeChange,
  onClearRanges,
  onClear,
  onToggleFocus,
}: BreakageToolbarProps) {
  const isNarrow = useMediaQuery('(max-width: 719px)')
  const rangeTexts = LOSS_RECORD_RANGE_FIELDS.map((field) =>
    describeRange(field.label, filters.numberRanges[field.key]),
  ).filter((text): text is string => text !== null)

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

        {/* Motivo e origem não tinham filtro nenhum até aqui — diferente da
            situação do saldo, acima, e da busca, que já cobrem outras
            colunas. */}
        <FilterMenu
          label="Motivo"
          options={reasons.map((r) => ({ id: r.id, label: r.label }))}
          selected={filters.reasonIds}
          onToggle={onToggleReason}
          onClear={onClearReason}
        />

        <FilterMenu
          label="Origem"
          options={origins.map((o) => ({ id: o.id, label: o.label }))}
          selected={filters.originIds}
          onToggle={onToggleOrigin}
          onClear={onClearOrigin}
        />

        <FilterPanel
          numberFields={LOSS_RECORD_RANGE_FIELDS}
          numberValues={filters.numberRanges}
          onNumberChange={(key, range) => onRangeChange(key as LossRecordRangeKey, range)}
          activeCount={countActiveRanges(filters.numberRanges)}
          onClear={onClearRanges}
        />

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
            {filters.reasonIds.length > 0 && (
              <>
                {' '}
                no motivo{' '}
                {filters.reasonIds
                  .map((id) => reasons.find((r) => r.id === id)?.label ?? id)
                  .join(', ')}
              </>
            )}
            {filters.originIds.length > 0 && (
              <>
                {' '}
                na origem{' '}
                {filters.originIds
                  .map((id) => origins.find((o) => o.id === id)?.label ?? id)
                  .join(', ')}
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
