import { Badge } from '@/shared/ui/Badge'
import { BarcodeIcon, EditIcon } from '@/shared/ui/icons'
import { SortButton } from '@/shared/ui/SortButton'
import { useListVirtualizer } from '@/shared/hooks/useListVirtualizer'
import type { SortDir } from '@/shared/hooks/useSort'
import type { Product } from '../types'
import styles from './ProductsTable.module.css'

export type ProductSortKey = 'barcode' | 'sku' | 'description'

interface ProductsTableProps {
  products: Product[]
  /** Ausente quando o perfil não pode editar: a coluna de ação some. */
  onEdit?: (product: Product) => void
  /**
   * Altura provável de uma linha, usada só até ela ser medida de verdade.
   * Um palpite próximo do real deixa a barra de rolagem estável desde o
   * primeiro quadro.
   */
  estimatedRowHeight: number
  /** Tela estreita: quem rola é a página, e a lista se ancora nela. */
  narrow: boolean
  sortKey: ProductSortKey | null
  sortDir: SortDir | null
  onSort: (key: ProductSortKey) => void
}

/**
 * Lista virtualizada: só as linhas visíveis existem no DOM.
 *
 * Sem isso, 26 mil linhas viram mais de 100 mil nós e o navegador engasga na
 * rolagem e no filtro. Com virtualização o custo passa a depender do tamanho
 * da janela, não do tamanho da base.
 */
export function ProductsTable({
  products,
  onEdit,
  estimatedRowHeight,
  narrow,
  sortKey,
  sortDir,
  onSort,
}: ProductsTableProps) {
  const { virtualizer, scrollerRef, canvasRef, scrollMargin } = useListVirtualizer({
    count: products.length,
    estimateSize: estimatedRowHeight,
    narrow,
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.head} role="presentation">
        <SortButton
          label="Código de barras"
          sortKey="barcode"
          activeKey={sortKey}
          activeDir={sortDir}
          onSort={onSort}
        />
        <SortButton label="SKU" sortKey="sku" activeKey={sortKey} activeDir={sortDir} onSort={onSort} />
        <SortButton
          label="Descrição"
          sortKey="description"
          activeKey={sortKey}
          activeDir={sortDir}
          onSort={onSort}
        />
        <span className="sr-only">Ações</span>
      </div>

      <div className={styles.scroller} ref={scrollerRef} tabIndex={narrow ? undefined : 0}>
        <div
          className={styles.canvas}
          ref={canvasRef}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const product = products[virtualRow.index]

            return (
              <div
                key={product.id}
                className={styles.item}
                // O virtualizador precisa do índice para saber qual linha
                // acabou de medir.
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                // O deslocamento desconta a margem: ancorada na página, a
                // posição que o virtualizador calcula já inclui o cabeçalho.
                style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
              >
                <div className={styles.itemInner}>
                  <span className={styles.barcode}>
                    {product.barcode ? (
                      <>
                        <BarcodeIcon className={styles.barcodeIcon} width={16} height={16} />
                        {product.barcode}
                      </>
                    ) : (
                      <span className={styles.semBarras}>sem código</span>
                    )}
                  </span>

                  <span className={styles.sku}>
                    {/* No celular não há cabeçalho de coluna: sem o rótulo,
                        o número solto poderia ser lido como quantidade. */}
                    <span className={styles.fieldLabel}>SKU</span>
                    {product.sku}
                  </span>
                  <span className={styles.description} title={product.description}>
                    {product.pendingCadastro ? (
                      <span className={styles.pending}>
                        <Badge tone="pendente">pendente</Badge>
                        <em>veio da importação de estoque, sem descrição ainda</em>
                      </span>
                    ) : (
                      product.description
                    )}
                  </span>

                  {onEdit && (
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => onEdit(product)}
                      aria-label={`Editar ${product.description}`}
                    >
                      <EditIcon width={18} height={18} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
