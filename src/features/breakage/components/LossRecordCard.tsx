import type { MouseEvent } from 'react'
import { Badge } from '@/shared/ui/Badge'
import { CalendarIcon, ChevronRightIcon } from '@/shared/ui/icons'
import { formatDate } from '@/shared/lib/date'
import { deadline } from '../deadline'
import { recordLabel } from '../label'
import { labelOf } from '../tags'
import type { LossRecord, Tag } from '../types'
import { AttachmentChips } from './AttachmentChips'
import styles from './LossRecordCard.module.css'

interface LossRecordCardProps {
  record: LossRecord
  reasons: Tag[]
  origins: Tag[]
  selected: boolean
  onToggleSelect: (id: string) => void
  onEdit: (record: LossRecord) => void
  onOpenAttachment: (record: LossRecord, attachmentId: string) => void
}

/**
 * Um registro de perda.
 *
 * Cartão em vez de linha de tabela porque a tela é usada no corredor, no
 * celular: o que interessa — o produto, quanto e por quê — precisa caber sem
 * rolagem lateral.
 *
 * Os botões de editar e excluir não cabem aqui: não entram na linha dos chips
 * (um motivo comprido já ocupa a largura toda) e numa linha própria custavam
 * 52px por registro — quase meio cartão a menos na tela. No lugar deles, o
 * cartão inteiro abre a edição, e a exclusão vem pela seleção, que já existe e
 * serve melhor quando é mais de um. Da largura de tablet para cima a lista
 * deixa de ser cartão e vira tabela, onde os botões cabem.
 */
export function LossRecordCard({
  record,
  reasons,
  origins,
  selected,
  onToggleSelect,
  onEdit,
  onOpenAttachment,
}: LossRecordCardProps) {
  // O cartão só existe no celular, onde a largura é o recurso escasso.
  const prazo = deadline(record, true)
  const motivo = labelOf(reasons, record.reasonId)
  const origem = labelOf(origins, record.originId)
  const zerado = record.quantity <= 0

  /**
   * Só abre a edição num clique que não era de outra coisa: marcar a caixa de
   * seleção ou selecionar o texto do código de barras para copiar continuam
   * fazendo o que a pessoa esperava.
   */
  function handleClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button, input, label, a')) return
    if (window.getSelection()?.toString()) return
    onEdit(record)
  }

  return (
    <article
      className={`${styles.card} ${styles.tappable} ${zerado ? styles.zeroed : ''} ${
        selected ? styles.selected : ''
      }`}
      onClick={handleClick}
    >
      <div className={styles.head}>
        {/* A caixa fica no cartão, e não numa barra que aparece só depois de um
            "modo seleção": marcar o segundo item não pode custar dois toques. */}
        <label className={styles.select}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={selected}
            onChange={() => onToggleSelect(record.id)}
          />
          <span className={styles.srOnly}>Selecionar {recordLabel(record)}</span>
        </label>

        <div className={styles.identity}>
          {/* No celular quem carrega a ação é o título, não o <article>: um
              botão não pode conter caixa de seleção e outros controles, ou o
              leitor de tela anuncia tudo como um bloco só. O clique no resto do
              cartão é atalho por cima disso, não o único caminho. */}
          <h2 className={styles.description}>
            <button
              type="button"
              className={styles.open}
              onClick={() => onEdit(record)}
              aria-label={`Editar registro de ${recordLabel(record)}`}
            >
              {record.description || 'Sem descrição'}
            </button>
          </h2>
          <span className={styles.codes}>
            {record.sku ? `SKU ${record.sku}` : 'SKU pendente'}
            {record.barcode && <span className={styles.barcode}>{record.barcode}</span>}
          </span>
          {/* Quem apontou e quando ficam junto da identidade, e não numa linha
              própria: era a linha mais barata de cortar, e cada uma cortada é
              meio registro a mais visível na lista. */}
          <span className={styles.author}>
            {record.createdBy} · {formatDate(record.createdAt.slice(0, 10))}
          </span>
        </div>

        <div className={styles.quantity}>
          <span className={styles.quantityValue}>{record.quantity}</span>
          <span className={styles.quantityLabel}>un</span>
        </div>

        {/* Sinal de que o cartão abre: sem ele, tocar para editar é um segredo. */}
        <ChevronRightIcon className={styles.chevron} width={18} height={18} />
      </div>

      {record.note && <p className={styles.note}>{record.note}</p>}

      <div className={styles.bottom}>
        <div className={styles.tags}>
          <span
            className={styles.deadline}
            style={
              {
                '--tone': `var(--situation-${prazo.token})`,
                '--tone-soft': `var(--situation-${prazo.token}-soft)`,
                '--tone-text': `var(--situation-${prazo.token}-text)`,
              } as React.CSSProperties
            }
          >
            <CalendarIcon width={13} height={13} />
            {record.expiryDate ? `${formatDate(record.expiryDate)} · ${prazo.text}` : prazo.text}
          </span>

          {motivo && <Badge tone="marca">{motivo}</Badge>}
          {origem && <Badge tone="neutro">{origem}</Badge>}
          {record.pendingProduct && <Badge tone="duplicado">Pendente</Badge>}
          {zerado && <Badge tone="invalido">Zerado</Badge>}

          {/* Os anexos fluem junto das etiquetas, e não numa coluna à direita:
              ali eles ficavam pendurados sozinhos quando os chips quebravam. */}
          <AttachmentChips
            attachments={record.attachments}
            onOpen={(attachmentId) => onOpenAttachment(record, attachmentId)}
          />
        </div>
      </div>
    </article>
  )
}
