import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { removeItems } from '../api'
import type { AuditRow } from '../types'

/** Nomes demais viram um muro de texto: mostra alguns e diz quantos faltam. */
const NAMES_SHOWN = 5

interface DeleteAuditItemsDialogProps {
  /** Os itens marcados. Vazio fecha o diálogo. */
  rows: AuditRow[]
  onClose: () => void
  onDeleted: () => void
}

/**
 * Confirma a exclusão dos itens marcados. Diz o que sai (os produtos e todos os
 * registros de contagem deles) e o que NÃO sai (o estoque), porque não há como
 * desfazer: a confirmação é a única proteção.
 */
export function DeleteAuditItemsDialog({ rows, onClose, onDeleted }: DeleteAuditItemsDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (rows.length === 0) return null

  const entries = rows.reduce((sum, row) => sum + row.entries.length, 0)
  const shown = rows.slice(0, NAMES_SHOWN)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await removeItems(rows.map((row) => ({ storeId: row.storeId, productId: row.productId })))
      onDeleted()
      onClose()
    } catch {
      setError('Não foi possível excluir. Verifique a conexão e tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={rows.length === 1 ? 'Excluir 1 item da auditoria' : `Excluir ${rows.length.toLocaleString('pt-BR')} itens da auditoria`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void confirm()}>
            {rows.length === 1 ? 'Excluir item' : 'Excluir itens'}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <p>
        Isto apaga a contagem {rows.length === 1 ? 'deste produto' : 'destes produtos'}, com os{' '}
        {entries.toLocaleString('pt-BR')} {entries === 1 ? 'registro' : 'registros'} de quem contou.
        O estoque não é alterado, e os outros itens da auditoria ficam como estão. Não dá para
        desfazer.
      </p>
      <ul>
        {shown.map((row) => (
          <li key={`${row.storeId}:${row.productId}`}>{row.description || `SKU ${row.sku}`}</li>
        ))}
        {rows.length > NAMES_SHOWN && <li>e mais {rows.length - NAMES_SHOWN}</li>}
      </ul>
    </Dialog>
  )
}
