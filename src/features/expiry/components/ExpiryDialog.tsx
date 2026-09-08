import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { TrashIcon } from '@/shared/ui/icons'
import { daysUntil, parseDate, type IsoDate } from '@/shared/lib/date'
import type { ExpiryRow } from '../types'
import styles from './ExpiryDialog.module.css'

/** O que o diálogo devolve ao salvar. */
export interface ExpiryEdit {
  expiryDate: IsoDate | null
  stock: number
  outflow: number
}

interface ExpiryDialogProps {
  row: ExpiryRow | null
  saving: boolean
  onClose: () => void
  onSave: (edit: ExpiryEdit) => void
  onDelete: () => void
}

/**
 * Corrige um lote.
 *
 * A validade é do **lote**; saldo e saídas são do **produto** — o mesmo número
 * que a tela de quebra usa para saber se o item ainda está no estoque. Mudar
 * aqui muda para todos os lotes daquele produto, e o diálogo diz isso em vez
 * de deixar a pessoa descobrir depois.
 *
 * Eles são editáveis porque nem sempre o relatório bate com a prateleira — e
 * porque, enquanto não há importação, é o único jeito de pôr um número real na
 * tela.
 *
 * Montado só quando aberto, e com chave por lote: os campos nascem preenchidos
 * com o lote certo sem um efeito sincronizando prop com estado.
 */
export function ExpiryDialog({ row, saving, onClose, onSave, onDelete }: ExpiryDialogProps) {
  if (!row) return null
  return (
    <Form
      key={row.id}
      row={row}
      saving={saving}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  )
}

function Form({ row, saving, onClose, onSave, onDelete }: ExpiryDialogProps & { row: ExpiryRow }) {
  const [expiryDate, setExpiryDate] = useState<IsoDate | null>(row.expiryDate)

  // Texto, e não número: um campo numérico controlado não deixa apagar o
  // conteúdo para digitar outro valor — o zero volta sozinho a cada tecla.
  const [stock, setStock] = useState(String(row.stock))
  const [outflow, setOutflow] = useState(String(row.outflow))

  const restantes = daysUntil(expiryDate)

  function handleSave() {
    onSave({
      expiryDate,
      stock: Number(stock) || 0,
      outflow: Number(outflow) || 0,
    })
  }

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
          <Button onClick={handleSave} loading={saving}>
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
            className={styles.input}
            type="date"
            value={expiryDate ?? ''}
            onChange={(event) => setExpiryDate(parseDate(event.target.value))}
          />
          {restantes !== null && (
            <span className={`${styles.hint} ${restantes < 0 ? styles.overdue : ''}`}>
              {restantes < 0
                ? `venceu há ${Math.abs(restantes)} dias`
                : restantes === 0
                  ? 'vence hoje'
                  : `vence em ${restantes} dias`}
            </span>
          )}
          {expiryDate === null && (
            <span className={styles.hint}>
              Sem data, o lote fica em “sem estimativa” e não entra na previsão.
            </span>
          )}
        </div>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>Números do produto</legend>

          <div className={styles.pair}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="expiry-stock">
                Estoque
              </label>
              <input
                id="expiry-stock"
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={0}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="expiry-outflow">
                Saídas no período
              </label>
              <input
                id="expiry-outflow"
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={0}
                value={outflow}
                onChange={(event) => setOutflow(event.target.value)}
              />
            </div>
          </div>

          <Alert>
            Estes dois números são do produto <strong>{row.sku}</strong>, não deste lote: valem
            para todos os lotes dele e para o que a tela de quebra considera em estoque. Normalmente
            vêm da importação dos relatórios; aqui você os corrige à mão.
          </Alert>

          <dl className={styles.codes}>
            <div>
              <dt>SKU</dt>
              <dd className={styles.mono}>{row.sku}</dd>
            </div>
            <div>
              <dt>Código de barras</dt>
              <dd className={styles.mono}>{row.barcode || '—'}</dd>
            </div>
          </dl>
        </fieldset>
      </div>
    </Dialog>
  )
}
