import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { clearAudit } from '../api'

interface ClearAuditDialogProps {
  open: boolean
  /** Quantos produtos contados serão apagados: a pessoa vê o tamanho do que perde. */
  count: number
  /** A loja a zerar, quando o administrador escolheu uma; vazio é a do login. */
  storeId?: string
  storeName?: string
  onClose: () => void
  onCleared: () => void
}

/**
 * Zera a contagem de UMA loja, para começar uma auditoria nova. Não tem volta,
 * então pede confirmação dizendo o que sai (e de qual loja).
 */
export function ClearAuditDialog({ open, count, storeId, storeName, onClose, onCleared }: ClearAuditDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await clearAudit(storeId)
      onCleared()
      onClose()
    } catch {
      setError('Não foi possível zerar a auditoria. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Zerar a auditoria"
      subtitle={storeName ? `Loja: ${storeName}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void confirm()}>
            Zerar contagem
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <p>
        Isto apaga a contagem de {count.toLocaleString('pt-BR')}{' '}
        {count === 1 ? 'produto' : 'produtos'}, com todos os registros de quem contou. O estoque não
        é alterado. Não dá para desfazer; use para começar uma contagem nova.
      </p>
    </Dialog>
  )
}
