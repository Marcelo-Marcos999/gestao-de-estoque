import { Badge } from '@/shared/ui/Badge'
import { useListVirtualizer } from '@/shared/hooks/useListVirtualizer'
import { EditIcon, TrashIcon } from '@/shared/ui/icons'
import { SortButton } from '@/shared/ui/SortButton'
import { formatDate } from '@/shared/lib/date'
import type { SortDir } from '@/shared/hooks/useSort'
import { deadline } from '../deadline'
import { recordLabel } from '../label'
import { labelOf } from '../tags'
import type { LossRecord, Tag } from '../types'
import { AttachmentChips } from './AttachmentChips'
import styles from './LossRecordTable.module.css'

export type LossRecordSortKey = 'description' | 'expiryDate' | 'quantity' | 'reason'

interface LossRecordTableProps {
  records: LossRecord[]
  reasons: Tag[]
  origins: Tag[]
  selection: ReadonlySet<string>
  onToggleSelect: (id: string) => void
  onEdit: (record: LossRecord) => void
  onDelete: (record: LossRecord) => void
  onOpenAttachment: (record: LossRecord, attachmentId: string) => void
  sortKey: LossRecordSortKey | null
  sortDir: SortDir | null
  onSort: (key: LossRecordSortKey) => void
}

/**
 * Lista dos registros de quebra em linhas.
 *
 * Mesma técnica e mesma grade da tela de validades: as duas mostram registros
 * de produto, e ler uma coluna no mesmo lugar nas duas telas vale mais que
 * cada tela ter o desenho ideal para si.
 *
 * Só as linhas visíveis existem no DOM. Abaixo de 720px a grade não cabe e a
 * lista vira cartão — o mesmo corte da tela de validades.
 */
export function LossRecordTable({
  records,
  reasons,
  origins,
  selection,
  onToggleSelect,
  onEdit,
  onDelete,
  onOpenAttachment,
  sortKey,
  sortDir,
  onSort,
}: LossRecordTableProps) {
  // A tabela só existe da largura de tablet para cima, onde a lista rola
  // dentro de si — daí `narrow` fixo em falso.
  const { virtualizer, scrollerRef, canvasRef } = useListVirtualizer({
    count: records.length,
    estimateSize: 62,
    narrow: false,
  })

  const sortProps = { activeKey: sortKey, activeDir: sortDir, onSort }

  return (
    <div className={styles.wrap}>
      <div className={styles.head} role="presentation">
        <span></span>
        <span></span>
        <SortButton label="Produto" sortKey="description" {...sortProps} />
        <SortButton label="Validade" sortKey="expiryDate" {...sortProps} />
        <SortButton label="Qtd" sortKey="quantity" {...sortProps} />
        <SortButton label="Motivo e origem" sortKey="reason" {...sortProps} />
        <span>Anexos</span>
        <span></span>
      </div>

      <div className={styles.scroller} ref={scrollerRef} tabIndex={0}>
        <div
          className={styles.canvas}
          ref={canvasRef}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const record = records[virtualRow.index]
            const prazo = deadline(record)
            const motivo = labelOf(reasons, record.reasonId)
            const origem = labelOf(origins, record.originId)
            const selecionado = selection.has(record.id)

            return (
              <div
                key={record.id}
                className={styles.item}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div
                  className={`${styles.itemInner} ${selecionado ? styles.selected : ''}`}
                  style={
                    { '--situation': `var(--situation-${prazo.token})` } as React.CSSProperties
                  }
                >
                  <span className={styles.stripe} />

                  <label className={styles.select}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selecionado}
                      onChange={() => onToggleSelect(record.id)}
                    />
                    <span className={styles.srOnly}>Selecionar {recordLabel(record)}</span>
                  </label>

                  <span className={styles.product}>
                    <span className={styles.description} title={record.description}>
                      {record.description || 'Sem descrição'}
                    </span>
                    <span className={styles.codes}>
                      {record.sku ? `SKU ${record.sku}` : 'SKU pendente'}
                      {record.barcode && ` · ${record.barcode}`}
                      {` · ${record.createdBy}`}
                    </span>
                  </span>

                  {record.expiryDate ? (
                    <span className={styles.expiry}>
                      <span className={styles.date}>{formatDate(record.expiryDate)}</span>
                      <span className={`${styles.remaining} ${styles[prazo.token]}`}>
                        {prazo.text}
                      </span>
                    </span>
                  ) : (
                    <span className={styles.absent}>sem validade</span>
                  )}

                  <span className={styles.number}>{record.quantity}</span>

                  <span className={styles.tags}>
                    {motivo && <Badge tone="marca">{motivo}</Badge>}
                    {origem && <Badge tone="neutro">{origem}</Badge>}
                    {record.pendingProduct && <Badge tone="duplicado">Pendente</Badge>}
                    {record.quantity <= 0 && <Badge tone="invalido">Zerado</Badge>}
                  </span>

                  <AttachmentChips
                    attachments={record.attachments}
                    onOpen={(attachmentId) => onOpenAttachment(record, attachmentId)}
                  />

                  <span className={styles.actions}>
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => onEdit(record)}
                      aria-label={`Editar registro de ${recordLabel(record)}`}
                    >
                      <EditIcon width={16} height={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.action} ${styles.delete}`}
                      onClick={() => onDelete(record)}
                      aria-label={`Excluir registro de ${recordLabel(record)}`}
                    >
                      <TrashIcon width={16} height={16} />
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
