import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { TrashIcon } from '@/shared/ui/icons'
import { daysUntil, parseDate, type IsoDate } from '@/shared/lib/date'
import type { ExpiryRow } from '../types'
import styles from './ExpiryDialog.module.css'

interface ExpiryDialogProps {
  row: ExpiryRow | null
  saving: boolean
  onClose: () => void
  onSave: (expiryDate: IsoDate | null) => void
  onDelete: () => void
}

/**
 * Corrige a validade de um lote.
 *
 * Só a validade se edita aqui. Saldo e saídas aparecem porque sustentam a
 * previsão da tela, mas em leitura: são do produto e vêm da importação dos
 * relatórios — editá-los por dentro de um lote deixaria dois lotes do mesmo
 * produto discordando sobre quanto existe na loja.
 *
 * Montado só quando aberto, e com chave por lote: os campos nascem preenchidos
 * com o lote certo sem um efeito sincronizando prop com estado.
 */
export function ExpiryDialog({ row, saving, onClose, onSave, onDelete }: ExpiryDialogProps) {
  if (!row) return null
  return (
    <Form key={row.id} row={row} saving={saving} onClose={onClose} onSave={onSave} onDelete={onDelete} />
  )
}

function Form({ row, saving, onClose, onSave, onDelete }: ExpiryDialogProps & { row: ExpiryRow }) {
  const [expiryDate, setExpiryDate] = useState<IsoDate | null>(row.expiryDate)
  const restantes = daysUntil(expiryDate)

  return (
    <Dialog
      open
      onClose={onClose}
      title="Editar lote"
      subtitle={row.description}
      footer={
        <>
          {/* Excluir fica do lado oposto de salvar: são ações contrárias, e
              vizinhas elas viram um erro de dedo no celular. */}
          <Button variant="danger" onClick={onDelete} disabled={saving}>
            <TrashIcon width={16} height={16} />
            <span>Excluir lote</span>
          </Button>
          <span className={styles.spacer} />
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(expiryDate)} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="expiry-date">
            Validade do lote
          </label>
          <input
            id="expiry-date"
            className={styles.date}
            type="date"
            value={expiryDate ?? ''}
            onChange={(event) => setExpiryDate(parseDate(event.target.value))}
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
          {expiryDate === null && (
            <span className={styles.remaining}>
              Sem data, o lote fica em “sem estimativa” e não entra na previsão.
            </span>
          )}
        </div>

        <div className={styles.readonly}>
          <span className={styles.readonlyTitle}>Do cadastro do produto</span>
          <dl className={styles.grid}>
            <div>
              <dt>SKU</dt>
              <dd className={styles.mono}>{row.sku}</dd>
            </div>
            <div>
              <dt>Código de barras</dt>
              <dd className={styles.mono}>{row.barcode || '—'}</dd>
            </div>
            <div>
              <dt>Estoque</dt>
              <dd>{row.stock}</dd>
            </div>
            <div>
              <dt>Saídas no período</dt>
              <dd>{row.outflow}</dd>
            </div>
          </dl>
          <Alert>
            Saldo e saídas vêm da importação dos relatórios e valem para o produto inteiro, não
            para este lote.
          </Alert>
        </div>
      </div>
    </Dialog>
  )
}
