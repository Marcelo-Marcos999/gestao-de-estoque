import { Badge } from '@/shared/ui/Badge'
import { EditIcon } from '@/shared/ui/icons'
import { SortButton } from '@/shared/ui/SortButton'
import { useListVirtualizer } from '@/shared/hooks/useListVirtualizer'
import type { SortDir } from '@/shared/hooks/useSort'
import { rowCostTotal, rowSaleTotal } from '../totals'
import type { StockRow } from '../types'
import styles from './StockTable.module.css'

export type StockSortKey =
  | 'description'
  | 'stock'
  | 'outflow'
  | 'costPrice'
  | 'salePrice'
  | 'totalCost'
  | 'totalSale'

interface StockTableProps {
  rows: StockRow[]
  estimatedRowHeight: number
  /** Tela estreita: quem rola é a página, e a lista se ancora nela. */
  narrow: boolean
  onEdit: (row: StockRow) => void
  sortKey: StockSortKey | null
  sortDir: SortDir | null
  onSort: (key: StockSortKey) => void
}

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Lista virtualizada dos produtos vistos pelo estoque. Mesma técnica das
 * outras telas: só as linhas visíveis existem no DOM, e cada linha mede a
 * própria altura porque a descrição pode quebrar em mais de uma linha.
 */
export function StockTable({
  rows,
  estimatedRowHeight,
  narrow,
  onEdit,
  sortKey,
  sortDir,
  onSort,
}: StockTableProps) {
  const { virtualizer, scrollerRef, canvasRef, scrollMargin } = useListVirtualizer({
    count: rows.length,
    estimateSize: estimatedRowHeight,
    narrow,
  })

  const sortProps = { activeKey: sortKey, activeDir: sortDir, onSort }

  return (
    <div className={styles.wrap}>
      <div className={styles.head} role="presentation">
        <SortButton label="Produto" sortKey="description" {...sortProps} />
        <SortButton label="Estoque" sortKey="stock" {...sortProps} />
        <SortButton label="Saídas" sortKey="outflow" {...sortProps} />
        <SortButton label="Custo" sortKey="costPrice" {...sortProps} />
        <SortButton label="Venda" sortKey="salePrice" {...sortProps} />
        <SortButton label="Total custo" sortKey="totalCost" {...sortProps} />
        <SortButton label="Total venda" sortKey="totalSale" {...sortProps} />
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
                key={row.productId}
                className={styles.item}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
              >
                <div className={styles.itemInner}>
                  <span className={styles.product}>
                    {row.pendingCadastro ? (
                      <span className={styles.pendingLine}>
                        <Badge tone="pendente">pendente</Badge>
                        <span className={styles.codes}>SKU {row.sku}</span>
                      </span>
                    ) : (
                      <>
                        <span className={styles.description} title={row.description}>
                          {row.description}
                        </span>
                        <span className={styles.codes}>
                          SKU {row.sku}
                          {row.barcode && ` · ${row.barcode}`}
                        </span>
                      </>
                    )}
                  </span>

                  <span className={styles.number}>{row.stock}</span>
                  <span className={styles.number}>{row.outflow}</span>
                  <span className={styles.number}>{money(row.costPrice)}</span>
                  <span className={styles.number}>{money(row.salePrice)}</span>
                  <span className={styles.number}>{money(rowCostTotal(row))}</span>
                  <span className={styles.number}>{money(rowSaleTotal(row))}</span>

                  {/* No celular os mesmos dados voltam com rótulo, porque ali
                      não existe cabeçalho de coluna para dizer o que é o quê. */}
                  <span className={styles.mobileData}>
                    <span>
                      <span className={styles.mobileLabel}>Estoque </span>
                      <span className={styles.mobileValue}>{row.stock}</span>
                    </span>
                    <span>
                      <span className={styles.mobileLabel}>Saídas </span>
                      <span className={styles.mobileValue}>{row.outflow}</span>
                    </span>
                    <span>
                      <span className={styles.mobileLabel}>Custo </span>
                      <span className={styles.mobileValue}>{money(row.costPrice)}</span>
                    </span>
                    <span>
                      <span className={styles.mobileLabel}>Venda </span>
                      <span className={styles.mobileValue}>{money(row.salePrice)}</span>
                    </span>
                    <span>
                      <span className={styles.mobileLabel}>Total custo </span>
                      <span className={styles.mobileValue}>{money(rowCostTotal(row))}</span>
                    </span>
                    <span>
                      <span className={styles.mobileLabel}>Total venda </span>
                      <span className={styles.mobileValue}>{money(rowSaleTotal(row))}</span>
                    </span>
                  </span>

                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={() => onEdit(row)}
                    aria-label={`Editar estoque de ${row.description || `SKU ${row.sku}`}`}
                  >
                    <EditIcon width={18} height={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
