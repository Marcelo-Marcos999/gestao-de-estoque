import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** O que vai acontecer, dito com os nomes das coisas: a pessoa vê o que perde. */
  text: string
  confirmLabel: string
  onClose: () => void
  /** Rejeitar mostra o erro no próprio diálogo, que continua aberto. */
  onConfirm: () => Promise<void>
}

/** Confirmação de uma ação que não tem volta (excluir pedido ou item). */
export function ConfirmDialog({ open, title, text, confirmLabel, onClose, onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch {
      setError('Não foi possível concluir. Verifique a conexão e tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <p>{text}</p>
    </Dialog>
  )
}
