import { useEffect, useState } from 'react'
import { ApiError } from '@/shared/lib/http'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { TextField } from '@/shared/ui/TextField'
import { deleteAllStock, getStockCounts, type StockCounts } from '../clearApi'
import styles from './DeleteAllStockDialog.module.css'

/** O que a pessoa precisa digitar: confirmar com um clique não protege de um clique errado. */
const CONFIRMATION = 'EXCLUIR'

interface DeleteAllStockDialogProps {
  open: boolean
  onClose: () => void
  onDeleted: () => void
}

/**
 * Apagar TODO o estoque da loja, para reimportar uma base do zero.
 *
 * Não tem desfazer — diferente da exclusão de registros avulsos, que oferece —,
 * porque desfazer milhares de linhas exigiria guardá-las todas. Por isso a
 * confirmação é forte: mostra o tamanho do estrago e exige digitar uma palavra.
 *
 * Quem usa troca a `key` a cada abertura, então o que foi digitado não volta.
 */
export function DeleteAllStockDialog({ open, onClose, onDeleted }: DeleteAllStockDialogProps) {
  const [counts, setCounts] = useState<StockCounts | null>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    getStockCounts()
      .then((c) => {
        if (!cancelled) setCounts(c)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível conferir o tamanho do estoque. Tente de novo.')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  async function confirm() {
    setError(null)
    setDeleting(true)
    try {
      await deleteAllStock()
      onDeleted()
      onClose()
    } catch (erro) {
      setError(erro instanceof ApiError ? erro.message : 'Não foi possível excluir. Tente de novo.')
    } finally {
      setDeleting(false)
    }
  }

  const empty = counts !== null && counts.rows === 0
  const ready = typed.trim().toUpperCase() === CONFIRMATION && counts !== null && !empty

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Excluir todo o estoque?"
      subtitle="Não tem desfazer."
      dismissible={!deleting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void confirm()} loading={deleting} disabled={!ready}>
            {deleting ? 'Excluindo…' : 'Excluir tudo'}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      {counts === null && !error && <p>Conferindo o que existe…</p>}

      {empty && <Alert tone="info">Não há nada no estoque desta loja para excluir.</Alert>}

      {counts !== null && !empty && (
        <div className={styles.body}>
          <p>
            Isto apaga o saldo, as saídas, o custo e a venda de{' '}
            <strong>{counts.rows.toLocaleString('pt-BR')}</strong> produto{counts.rows === 1 ? '' : 's'}
            {counts.lots > 0 && (
              <>
                {' '}
                e os <strong>{counts.lots.toLocaleString('pt-BR')}</strong> lote
                {counts.lots === 1 ? '' : 's'} de validade que dependem dele{counts.rows === 1 ? '' : 's'}
              </>
            )}
            .
          </p>
          <p>
            Os produtos continuam no Cadastro de produtos e os registros de quebra não são tocados.
            Use isto para começar a importar uma base do zero.
          </p>

          <TextField
            label={`Para confirmar, digite ${CONFIRMATION}`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
      )}
    </Dialog>
  )
}
