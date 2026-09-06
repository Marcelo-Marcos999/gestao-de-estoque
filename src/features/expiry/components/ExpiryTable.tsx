import { formatDate } from '@/shared/lib/date'
import { useListVirtualizer } from '@/shared/hooks/useListVirtualizer'
import { SITUATIONS } from '../situation'
import type { ExpiryRow } from '../types'
import { SituationBadge } from './SituationBadge'
import styles from './ExpiryTable.module.css'

interface ExpiryTableProps {
  rows: ExpiryRow[]
  estimatedRowHeight: number
  /** Tela estreita: quem rola é a página, e a lista se ancora nela. */
  narrow: boolean
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
export function ExpiryTable({ rows, estimatedRowHeight, narrow }: ExpiryTableProps) {
  const { virtualizer, scrollerRef, canvasRef, scrollMargin } = useListVirtualizer({
    count: rows.length,
    estimateSize: estimatedRowHeight,
    narrow,
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.head} role="presentation">
        <span></span>
        <span>Produto</span>
        <span>Validade</span>
        <span>Estoque</span>
        <span>Sai em</span>
        <span>Situação</span>
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
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
