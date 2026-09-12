import type { FormEvent } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { AlertIcon } from '@/shared/ui/icons'
import { daysUntil, parseDate } from '@/shared/lib/date'
import { useState } from 'react'
import { useAuth } from '@/features/auth'
import { useLossRecordForm } from '../hooks/useLossRecordForm'
import type { Attachment, LossRecord } from '../types'
import { AttachmentSlots } from './AttachmentSlots'
import { AttachmentViewer } from './AttachmentViewer'
import { DuplicateWarning } from './DuplicateWarning'
import { ProductPicker } from './ProductPicker'
import { QuantityField } from './QuantityField'
import { TagPicker } from './TagPicker'
import styles from './LossRecordDialog.module.css'

interface LossRecordDialogProps {
  open: boolean
  /** Registro a alterar. Ausente, o formulário cria um novo. */
  record?: LossRecord
  onClose: () => void
  onSaved: () => void
}

/**
 * Registro de uma perda.
 *
 * Costura as partes; toda a lógica vive em `useLossRecordForm`. A ordem dos
 * campos é a ordem do trabalho no corredor: primeiro o produto na mão, depois
 * quanto e por quê, e só então o que comprova.
 */
export function LossRecordDialog({ open, record, onClose, onSaved }: LossRecordDialogProps) {
  // Montar só quando aberto zera os campos a cada abertura, e a chave garante
  // que abrir outro registro para editar não reaproveite o estado do anterior
  // — o que um efeito sincronizando prop com estado faria pior.
  if (!open) return null
  return (
    <LossRecordForm key={record?.id ?? 'novo'} record={record} onClose={onClose} onSaved={onSaved} />
  )
}

function LossRecordForm({ record, onClose, onSaved }: Omit<LossRecordDialogProps, 'open'>) {
  const { user } = useAuth()
  const form = useLossRecordForm(
    user?.name ?? 'Sistema',
    () => {
      onSaved()
      onClose()
    },
    record,
  )

  const restantes = daysUntil(form.expiryDate)

  /** Anexo aberto para ver de dentro do próprio formulário. */
  const [vendo, setVendo] = useState<Attachment | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void form.submit()
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={form.editing ? 'Editar registro' : 'Registrar quebra'}
        subtitle={
          form.editing
            ? 'Corrija o que foi apontado. O histórico é o próprio registro.'
            : 'Aponte o que saiu do estoque sem ser vendido.'
        }
        footer={
          <>
            {form.product?.pendingProduct && (
              <span className={styles.pendingNotice}>
                <AlertIcon className={styles.pendingIcon} width={15} height={15} />
                Vai entrar como <span className={styles.pendingStrong}>pendente de cadastro</span>
              </span>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="loss-record-form" loading={form.saving}>
              {form.editing ? 'Salvar alterações' : 'Salvar registro'}
            </Button>
          </>
        }
      >
        <form className={styles.form} id="loss-record-form" onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <span className={styles.label}>Produto</span>
            <ProductPicker
              chosen={form.product}
              onChoose={form.setProduct}
              onDescriptionChange={form.setPendingDescription}
            />
            {form.errors.product && <Alert tone="danger">{form.errors.product}</Alert>}
          </div>

          <div className={styles.pair}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="loss-expiry">
                Validade <span className={styles.optional}>(opcional)</span>
              </label>
              <input
                id="loss-expiry"
                className={styles.date}
                type="date"
                value={form.expiryDate ?? ''}
                onChange={(event) => form.setExpiryDate(parseDate(event.target.value))}
              />
              {restantes !== null && (
                <span className={`${styles.remaining} ${restantes < 0 ? styles.overdue : ''}`}>
                  {restantes < 0
                    ? `venceu há ${Math.abs(restantes)} dias`
                    : restantes === 0
                      ? 'vence hoje'
                      : `vence em ${restantes} dias`}
                </span>
              )}
            </div>

            <QuantityField
              value={form.quantity}
              stock={form.product?.stock ?? 0}
              pendingProduct={form.product?.pendingProduct ?? false}
              onChange={form.setQuantity}
            />
          </div>

          <TagPicker
            label="Motivo"
            tags={form.reasons}
            value={form.reasonId}
            error={form.errors.reason}
            usage={form.tagUsage.reasons}
            onChange={form.setReasonId}
            onCreate={form.addReason}
            onRename={(id, label) => form.renameTag('reason', id, label)}
            onDelete={(id) => form.deleteTag('reason', id)}
          />

          <TagPicker
            label="Origem"
            tags={form.origins}
            value={form.originId}
            optional
            usage={form.tagUsage.origins}
            onChange={form.setOriginId}
            onCreate={form.addOrigin}
            onRename={(id, label) => form.renameTag('origin', id, label)}
            onDelete={(id) => form.deleteTag('origin', id)}
          />

          <AttachmentSlots
            attachments={form.attachments}
            onAttach={form.attachFile}
            onRemove={form.removeAttachment}
            onOpen={setVendo}
          />

          <div className={styles.field}>
            <label className={styles.label} htmlFor="loss-note">
              Observação <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id="loss-note"
              className={styles.note}
              value={form.note}
              onChange={(event) => form.setNote(event.target.value)}
              placeholder="O que aconteceu, se ajudar a entender depois"
            />
          </div>
        </form>
      </Dialog>

      <AttachmentViewer attachment={vendo} onClose={() => setVendo(null)} />

      <DuplicateWarning
        open={form.duplicate !== null}
        existing={form.duplicate}
        reasons={form.reasons}
        quantity={form.quantity}
        editing={form.editing}
        busy={form.saving}
        onClose={form.dismissDuplicate}
        onCreateSeparate={() => void form.createSeparate()}
        onAddToExisting={() => void form.mergeIntoExisting()}
      />
    </>
  )
}
