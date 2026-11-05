import { useState } from 'react'
import { limitMessage } from '@/shared/lib/limits'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { removeEntry } from '../api'
import { formatWhen } from '../format'
import type { AuditRow } from '../types'
import styles from './AuditEntriesDialog.module.css'

interface AuditEntriesDialogProps {
  row: AuditRow | null
  onClose: () => void
  /** Uma parcela saiu: a lista atrás precisa reler. */
  onChanged: () => void
}

/**
 * De onde veio a contagem de um produto: cada parcela, com quem registrou e
 * quando. É a prova da conferência, e o lugar onde se desfaz um registro errado
 * sem perder os outros.
 */
export function AuditEntriesDialog({ row, onClose, onChanged }: AuditEntriesDialogProps) {
  // Dois toques para excluir: o primeiro pede a confirmação, no próprio lugar.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!row) return null

  async function remove(entryId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeEntry(entryId)
      setConfirming(null)
      onChanged()
      // Era a última parcela: o produto some da lista, e o diálogo com ele.
      if (row && row.entries.length === 1) onClose()
    } catch (erro) {
      setError(limitMessage(erro) ?? 'Não foi possível excluir. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={row.description || `SKU ${row.sku}`}
      subtitle={`Contagem ${row.counted}, somando ${row.entries.length} ${row.entries.length === 1 ? 'registro' : 'registros'}.`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <ul className={styles.list}>
        {row.entries.map((entry) => (
          <li className={styles.item} key={entry.id}>
            <span className={styles.quantity}>{entry.quantity}</span>
            <span className={styles.meta}>
              {entry.by}
              <span className={styles.when}>{formatWhen(entry.at)}</span>
            </span>

            {confirming === entry.id ? (
              <span className={styles.confirm}>
                <Button variant="danger" loading={busy} onClick={() => void remove(entry.id)}>
                  Excluir
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(null)}>
                  Cancelar
                </Button>
              </span>
            ) : (
              <Button variant="ghost" onClick={() => setConfirming(entry.id)}>
                Excluir
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
