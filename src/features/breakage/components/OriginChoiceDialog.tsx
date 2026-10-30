import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Select } from '@/shared/ui/Select'
import { Alert } from '@/shared/ui/Alert'
import { loadTags } from '../tags'
import type { Tag } from '../types'

interface OriginChoiceDialogProps {
  open: boolean
  /** Quantos registros serão criados com a origem escolhida. */
  count: number
  onClose: () => void
  /** Devolve a mensagem de erro, ou `null` quando enviou: o diálogo só fecha por quem o abriu. */
  onConfirm: (originId: string) => Promise<string | null>
}

/**
 * Pergunta a origem uma vez só, para um grupo de registros criados de uma vez.
 *
 * O motivo dispensa pergunta no envio em massa de lotes vencidos ("venceu" já
 * é o motivo), mas a origem não se deduz: um lote vencido pode ter chegado
 * assim do CD ou ter vencido na prateleira, e é essa diferença que o relatório
 * por origem existe para mostrar (ver docs/dominio.md).
 *
 * Quem usa troca a `key` a cada abertura, então o que foi escolhido da última
 * vez não volta sozinho.
 */
export function OriginChoiceDialog({ open, count, onClose, onConfirm }: OriginChoiceDialogProps) {
  const [origins, setOrigins] = useState<Tag[]>([])
  const [originId, setOriginId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    loadTags()
      .then((lists) => {
        if (!cancelled) setOrigins(lists.origins)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar as origens. Tente novamente.')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  async function confirm() {
    if (!originId) {
      setError('Escolha a origem.')
      return
    }

    setError(null)
    setSending(true)
    const failure = await onConfirm(originId)
    setSending(false)
    if (failure) setError(failure)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="De onde veio o problema?"
      subtitle={`A origem vale para os ${count} ${count === 1 ? 'registro' : 'registros'} de quebra.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} loading={sending}>
            {sending ? 'Enviando…' : 'Enviar para quebra'}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <Select
        label="Origem"
        value={originId}
        onChange={(event) => {
          setOriginId(event.target.value)
          setError(null)
        }}
        options={[
          { value: '', label: 'Escolha a origem' },
          ...origins.map((origin) => ({ value: origin.id, label: origin.label })),
        ]}
      />
    </Dialog>
  )
}
