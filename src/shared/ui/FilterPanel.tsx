import { useEffect, useRef, useState } from 'react'
import type { DateRange } from '@/shared/lib/dateRange'
import type { NumberRange } from '@/shared/lib/numberRange'
import { FilterIcon } from './icons'
import styles from './FilterPanel.module.css'

export interface NumberRangeField {
  key: string
  label: string
}

interface FilterPanelProps {
  /** Um único campo de período — no máximo um por tela, a única data que existe nela. */
  dateLabel?: string
  dateValue?: DateRange
  onDateChange?: (range: DateRange) => void
  numberFields?: NumberRangeField[]
  numberValues?: Record<string, NumberRange>
  onNumberChange?: (key: string, range: NumberRange) => void
  /** Quantos parâmetros estão ativos agora, para o selo no botão. */
  activeCount: number
  onClear: () => void
}

/**
 * Painel único com todos os parâmetros de uma tela — período quando há data,
 * mínimo e máximo para números — atrás de um botão "Filtro" só.
 *
 * Reciclado do ícone de filtro do AppSheet: lá era um painel só, não um botão
 * por coluna. Aqui ele reúne período e faixas numéricas; categorias com lista
 * fixa (motivo, origem, situação) continuam com seu próprio controle, porque
 * já existiam e listar opções não é a mesma pergunta que um intervalo.
 *
 * Fecha ao clicar fora ou apertar Esc, como o `FilterMenu` de categoria.
 */
export function FilterPanel({
  dateLabel,
  dateValue,
  onDateChange,
  numberFields = [],
  numberValues = {},
  onNumberChange,
  activeCount,
  onClear,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const active = activeCount > 0

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${active ? styles.active : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span>Filtro</span>
        <FilterIcon width={14} height={14} className={active ? styles.filledIcon : undefined} />
        {active && <span className={styles.count}>{activeCount}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          {dateLabel && dateValue && onDateChange && (
            <fieldset className={styles.group}>
              <legend className={styles.groupLabel}>{dateLabel}</legend>
              <div className={styles.rangeRow}>
                <input
                  type="date"
                  className={styles.dateInput}
                  aria-label={`${dateLabel}, a partir de`}
                  value={dateValue.from ?? ''}
                  onChange={(event) =>
                    onDateChange({ ...dateValue, from: event.target.value || null })
                  }
                />
                <span className={styles.rangeSep}>até</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  aria-label={`${dateLabel}, até`}
                  value={dateValue.to ?? ''}
                  onChange={(event) =>
                    onDateChange({ ...dateValue, to: event.target.value || null })
                  }
                />
              </div>
            </fieldset>
          )}

          {numberFields.map((field) => {
            const range = numberValues[field.key] ?? { min: null, max: null }
            return (
              <fieldset key={field.key} className={styles.group}>
                <legend className={styles.groupLabel}>{field.label}</legend>
                <div className={styles.rangeRow}>
                  <input
                    type="number"
                    inputMode="decimal"
                    className={styles.numberInput}
                    placeholder="Mín."
                    aria-label={`${field.label}, mínimo`}
                    value={range.min ?? ''}
                    onChange={(event) =>
                      onNumberChange?.(field.key, {
                        ...range,
                        min: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                  <span className={styles.rangeSep}>até</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className={styles.numberInput}
                    placeholder="Máx."
                    aria-label={`${field.label}, máximo`}
                    value={range.max ?? ''}
                    onChange={(event) =>
                      onNumberChange?.(field.key, {
                        ...range,
                        max: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </div>
              </fieldset>
            )
          })}

          {active && (
            <button type="button" className={styles.clear} onClick={onClear}>
              Limpar filtro
            </button>
          )}
        </div>
      )}
    </div>
  )
}
