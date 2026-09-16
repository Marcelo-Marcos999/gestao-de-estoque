import { BoltIcon, EditIcon } from '@/shared/ui/icons'
import { SortButton } from '@/shared/ui/SortButton'
import { formatDate } from '@/shared/lib/date'
import { useListVirtualizer } from '@/shared/hooks/useListVirtualizer'
import type { SortDir } from '@/shared/hooks/useSort'
import { SITUATIONS } from '../situation'
import type { ExpiryRow } from '../types'
import { SituationBadge } from './SituationBadge'
import styles from './ExpiryTable.module.css'

export type ExpirySortKey = 'description' | 'expiryDate' | 'stock' | 'daysToZero' | 'situation'

interface ExpiryTableProps {
  rows: ExpiryRow[]
  estimatedRowHeight: number
  /** Tela estreita: quem rola é a página, e a lista se ancora nela. */
  narrow: boolean
  onEdit: (row: ExpiryRow) => void
  /** Só existe em lotes vencidos: gera a quebra da quantidade que sobrou. */
  onGenerateBreakage: (row: ExpiryRow) => void
  sortKey: ExpirySortKey | null
  sortDir: SortDir | null
  onSort: (key: ExpirySortKey) => void
}

/** "em 212 dias", "venceu há 149 dias" — o número cru não diz o que significa. */
function remainingLabel(days: number | null): { text: string; overdue: boolean } | null {
  if (days === null) return null
  if (days < 0) return { text: `venceu há ${Math.abs(days)} dias`, overdue: true }
  if (days === 0) return { text: 'vence hoje', overdue: true }
  if (days === 1) return { text: 'vence amanhã', overdue: false }
  return { text: `em ${days} dias`, overdue: false }
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
  onGenerateBreakage,
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
            const remaining = remainingLabel(row.daysToExpiry)
            const token = SITUATIONS[row.situation].token

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
                <div
                  className={styles.itemInner}
                  style={{ '--situation': `var(--situation-${token})` } as React.CSSProperties}
                >
                  <span className={styles.stripe} />

                  <span className={styles.product}>
                    <span className={styles.description} title={row.description}>
                      {row.description}
                    </span>
                    <span className={styles.codes}>
                      SKU {row.sku}
                      {row.barcode && ` · ${row.barcode}`}
                    </span>
                  </span>

                  {row.expiryDate ? (
                    <span className={styles.expiry}>
                      <span className={styles.date}>{formatDate(row.expiryDate)}</span>
                      {remaining && (
                        <span
                          className={`${styles.remaining} ${remaining.overdue ? styles.overdue : ''}`}
                        >
                          {remaining.text}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className={styles.absent}>sem data</span>
                  )}

                  <span className={styles.number}>{row.stock}</span>

                  {row.daysToZero === null ? (
                    <span className={styles.absent}>sem saídas</span>
                  ) : (
                    <span className={styles.number}>{row.daysToZero} dias</span>
                  )}

                  {/* No celular os mesmos dados voltam com rótulo, porque ali
                      não existe cabeçalho de coluna para dizer o que é o quê. */}
                  <span className={styles.mobileData}>
                    <span>
                      <span className={styles.mobileLabel}>
                        {remaining?.overdue ? 'Venceu ' : 'Vence '}
                      </span>
                      <span className={styles.mobileValue}>
                        {row.expiryDate ? formatDate(row.expiryDate) : '—'}
                      </span>
                    </span>
                    <span>
                      <span className={styles.mobileLabel}>Estoque </span>
                      <span className={styles.mobileValue}>{row.stock}</span>
                    </span>
                    <span>
                      <span className={styles.mobileLabel}>Sai em </span>
                      <span className={styles.mobileValue}>
                        {row.daysToZero === null ? '—' : `${row.daysToZero} dias`}
                      </span>
                    </span>
                  </span>

                  <span className={styles.situation}>
                    <SituationBadge situation={row.situation} />
                  </span>

                  {/* No celular a linha vira cartão e estes botões ficam na
                      área da situação, ao lado da faixa — o mesmo lugar em
                      que o cadastro de produtos põe o seu. */}
                  <span className={styles.actions}>
                    {/* Só em lotes vencidos: gerar quebra de uma situação que
                        já vai bem, ou sem estimativa, não faz sentido — nada
                        venceu ainda. */}
                    {row.situation === 'venceu' && (
                      <button
                        type="button"
                        className={styles.action}
                        onClick={() => onGenerateBreakage(row)}
                        aria-label={`Gerar quebra de ${row.description}`}
                        title="Gerar quebra"
                      >
                        <BoltIcon width={16} height={16} />
                      </button>
                    )}

                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => onEdit(row)}
                      aria-label={`Editar lote de ${row.description}`}
                    >
                      <EditIcon width={16} height={16} />
                    </button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
