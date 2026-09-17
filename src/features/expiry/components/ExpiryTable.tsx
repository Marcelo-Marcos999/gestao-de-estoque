import { SortButton } from '@/shared/ui/SortButton'
import { useListVirtualizer } from '@/shared/hooks/useListVirtualizer'
import type { SortDir } from '@/shared/hooks/useSort'
import type { ExpiryRow } from '../types'
import { ExpiryTableRow } from './ExpiryTableRow'
import styles from './ExpiryTable.module.css'

export type ExpirySortKey = 'description' | 'expiryDate' | 'stock' | 'daysToZero' | 'situation'

interface ExpiryTableProps {
  rows: ExpiryRow[]
  estimatedRowHeight: number
  /** Tela estreita: quem rola é a página, e a lista se ancora nela. */
  narrow: boolean
  onEdit: (row: ExpiryRow) => void
  onDelete: (row: ExpiryRow) => void
  /** Só existe em lotes vencidos: gera a quebra da quantidade que sobrou. */
  onGenerateBreakage: (row: ExpiryRow) => void
  selection: ReadonlySet<string>
  onToggleSelect: (id: string) => void
  sortKey: ExpirySortKey | null
  sortDir: SortDir | null
  onSort: (key: ExpirySortKey) => void
}

/**
 * Lista virtualizada dos lotes acompanhados.
 *
 * Mesma técnica do cadastro de produtos: só as linhas visíveis existem no DOM,
 * e cada linha mede a própria altura porque no celular a descrição quebra em
 * um número variável de linhas.
 */
export function ExpiryTable({
  rows,
  estimatedRowHeight,
  narrow,
  onEdit,
  onDelete,
  onGenerateBreakage,
  selection,
  onToggleSelect,
  sortKey,
  sortDir,
  onSort,
}: ExpiryTableProps) {
  const { virtualizer, scrollerRef, canvasRef, scrollMargin } = useListVirtualizer({
    count: rows.length,
    estimateSize: estimatedRowHeight,
    narrow,
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.head} role="presentation">
        <span></span>
        <span></span>
        <SortButton
          label="Produto"
          sortKey="description"
          activeKey={sortKey}
          activeDir={sortDir}
          onSort={onSort}
        />
        <SortButton
          label="Validade"
          sortKey="expiryDate"
          activeKey={sortKey}
          activeDir={sortDir}
          onSort={onSort}
        />
        <SortButton
          label="Estoque"
          sortKey="stock"
          activeKey={sortKey}
          activeDir={sortDir}
          onSort={onSort}
        />
        <SortButton
          label="Sai em"
          sortKey="daysToZero"
          activeKey={sortKey}
          activeDir={sortDir}
          onSort={onSort}
        />
        <SortButton
          label="Situação"
          sortKey="situation"
          activeKey={sortKey}
          activeDir={sortDir}
          onSort={onSort}
        />
        <span className={styles.srOnly}>Ações</span>
      </div>

      <div className={styles.scroller} ref={scrollerRef} tabIndex={narrow ? undefined : 0}>
        <div
          className={styles.canvas}
          ref={canvasRef}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]

            return (
              <div
                key={row.id}
                className={styles.item}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                // O deslocamento desconta a margem: ancorada na página, a
                // posição que o virtualizador calcula já inclui o cabeçalho.
                style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
              >
                <ExpiryTableRow
                  row={row}
                  selected={selection.has(row.id)}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onGenerateBreakage={onGenerateBreakage}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
