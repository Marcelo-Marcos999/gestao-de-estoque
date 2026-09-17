import { useEffect, useRef, useState } from 'react'
import { FilterIcon } from './icons'
import styles from './FilterMenu.module.css'

export interface FilterMenuOption {
  id: string
  label: string
}

interface FilterMenuProps {
  label: string
  options: FilterMenuOption[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
}

/**
 * Filtro por valor de uma coluna, atrás de um botão — para uma lista de
 * opções que não caberia sempre visível na barra de ferramentas (motivo,
 * origem, e outras colunas de valores fixos que vierem depois).
 *
 * Fecha ao clicar fora ou apertar Esc, como o diálogo já faz — sem prender o
 * foco, porque isto não é um formulário que bloqueia o resto da tela.
 */
export function FilterMenu({ label, options, selected, onToggle, onClear }: FilterMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const active = selected.length > 0

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
        <span>{label}</span>
        <FilterIcon width={14} height={14} className={active ? styles.filledIcon : undefined} />
        {active && <span className={styles.count}>{selected.length}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          {options.length === 0 ? (
            <p className={styles.empty}>Nenhuma opção ainda.</p>
          ) : (
            <ul className={styles.options}>
              {options.map((option) => (
                <li key={option.id}>
                  <label className={styles.option}>
                    <input
                      type="checkbox"
                      checked={selected.includes(option.id)}
                      onChange={() => onToggle(option.id)}
                    />
                    {option.label}
                  </label>
                </li>
              ))}
            </ul>
          )}

          {active && (
            <button type="button" className={styles.clear} onClick={onClear}>
              Limpar {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
