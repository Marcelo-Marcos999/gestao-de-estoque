import { Button } from '@/shared/ui/Button'
import { SearchIcon } from '@/shared/ui/icons'
import type { OrderQuery, StatusFilter } from '../types'
import styles from './OrdersToolbar.module.css'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abertos' },
  { value: 'closed', label: 'Fechados' },
]

interface OrdersToolbarProps {
  filters: OrderQuery
  isFiltered: boolean
  /** Quantos pedidos o filtro encontrou, para quem restaurou o filtro de ontem entender a lista. */
  found: number
  onSearch: (value: string) => void
  onStatus: (value: StatusFilter) => void
  onClear: () => void
}

/**
 * Busca e filtro de estado. O filtro volta como a pessoa deixou (ver CLAUDE.md), então,
 * enquanto houver um ativo, o que está escondido aparece escrito, com o jeito de
 * limpar: uma lista de "Fechados" que parece a lista inteira faria os abertos
 * parecerem ter sumido.
 */
export function OrdersToolbar({ filters, isFiltered, found, onSearch, onStatus, onClear }: OrdersToolbarProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            className={styles.input}
            type="search"
            value={filters.search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar por cliente ou número"
            aria-label="Buscar pedidos por cliente ou número"
            autoComplete="off"
          />
        </div>

        <div className={styles.segments} role="group" aria-label="Estado do pedido">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.segment}
              aria-pressed={filters.status === option.value}
              onClick={() => onStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isFiltered && (
        <div className={styles.active} role="status">
          <span>
            Filtro ativo: {found.toLocaleString('pt-BR')} {found === 1 ? 'pedido encontrado' : 'pedidos encontrados'}.
          </span>
          <Button variant="ghost" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
