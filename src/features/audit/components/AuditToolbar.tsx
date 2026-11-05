import { Button } from '@/shared/ui/Button'
import { ScanButton } from '@/shared/ui/ScanButton'
import { SearchIcon } from '@/shared/ui/icons'
import type { AuditQuery } from '../types'
import styles from './AuditToolbar.module.css'

interface AuditToolbarProps {
  filters: AuditQuery
  isFiltered: boolean
  /** Quantos produtos a busca mostra, para quem restaurou um filtro de ontem entender a lista. */
  shown: number
  total: number
  narrow: boolean
  onSearch: (value: string) => void
  onToggleDifferences: (value: boolean) => void
  onClear: () => void
}

/**
 * Busca e filtro da auditoria. O filtro volta como a pessoa deixou (ver
 * CLAUDE.md), então, enquanto houver um ativo, o que está escondido aparece
 * escrito, com o jeito de limpar: uma lista filtrada que parece a lista inteira
 * faria a contagem parecer menor do que é.
 */
export function AuditToolbar({
  filters,
  isFiltered,
  shown,
  total,
  narrow,
  onSearch,
  onToggleDifferences,
  onClear,
}: AuditToolbarProps) {
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
            placeholder={narrow ? 'Buscar produto' : 'Buscar por descrição, SKU ou código de barras'}
            aria-label="Buscar produtos na auditoria"
            autoComplete="off"
          />
          <ScanButton onDetect={onSearch} label="Buscar por código de barras" />
        </div>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={filters.onlyDifferences}
            onChange={(event) => onToggleDifferences(event.target.checked)}
          />
          Só com diferença
        </label>
      </div>

      {isFiltered && (
        <div className={styles.active} role="status">
          <span>
            Filtro ativo: mostrando {shown.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}{' '}
            produtos contados.
          </span>
          <Button variant="ghost" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
