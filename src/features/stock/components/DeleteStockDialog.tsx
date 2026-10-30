import { useEffect, useState } from 'react'
import { ApiError } from '@/shared/lib/http'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { TextField } from '@/shared/ui/TextField'
import {
  deleteAllStock,
  deleteStockRows,
  getSelectionCounts,
  getStockCounts,
  type StockCounts,
} from '../clearApi'
import styles from './DeleteStockDialog.module.css'

/** O que a pessoa precisa digitar para apagar TUDO: um clique errado não pode bastar. */
const CONFIRMATION = 'EXCLUIR'

interface DeleteStockDialogProps {
  open: boolean
  /** Os produtos escolhidos na tela; `null` apaga o estoque inteiro da loja. */
  productIds: string[] | null
  onClose: () => void
  onDeleted: () => void
}

/**
 * Confirmação de apagar estoque: de alguns produtos escolhidos, ou de todos.
 *
 * Não tem desfazer — diferente da exclusão de registros avulsos nas outras
 * telas, que oferece —, porque apagar uma posição leva os lotes de validade
 * junto, e restaurá-los exigiria guardar tudo o que saiu. Por isso a
 * confirmação mostra o tamanho do estrago. Para **tudo** ela também exige
 * digitar uma palavra; para uma seleção, a pessoa já marcou linha por linha.
 *
 * Quem usa troca a `key` a cada abertura, então o que foi digitado não volta.
 */
export function DeleteStockDialog({ open, productIds, onClose, onDeleted }: DeleteStockDialogProps) {
  const all = productIds === null
  const [counts, setCounts] = useState<StockCounts | null>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    ;(all ? getStockCounts() : getSelectionCounts(productIds))
      .then((c) => {
        if (!cancelled) setCounts(c)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível conferir o tamanho da exclusão. Tente de novo.')
      })
    return () => {
      cancelled = true
    }
  }, [open, all, productIds])

  async function confirm() {
    setError(null)
    setDeleting(true)
    try {
      await (all ? deleteAllStock() : deleteStockRows(productIds))
      onDeleted()
      onClose()
    } catch (erro) {
      setError(erro instanceof ApiError ? erro.message : 'Não foi possível excluir. Tente de novo.')
    } finally {
      setDeleting(false)
    }
  }

  const empty = counts !== null && counts.rows === 0
  const typedOk = !all || typed.trim().toUpperCase() === CONFIRMATION
  const ready = typedOk && counts !== null && !empty
  const n = counts?.rows ?? 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={all ? 'Excluir todo o estoque?' : `Excluir ${productIds.length.toLocaleString('pt-BR')} do estoque?`}
      subtitle="Não tem desfazer."
      dismissible={!deleting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void confirm()} loading={deleting} disabled={!ready}>
            {deleting ? 'Excluindo…' : all ? 'Excluir tudo' : 'Excluir'}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      {counts === null && !error && <p>Conferindo o que existe…</p>}

      {empty && <Alert tone="info">Não há estoque para excluir.</Alert>}

      {counts !== null && !empty && (
        <div className={styles.body}>
          <p>
            Isto apaga o saldo, as saídas, o custo e a venda de{' '}
            <strong>{n.toLocaleString('pt-BR')}</strong> produto{n === 1 ? '' : 's'}
            {counts.lots > 0 && (
              <>
                {' '}
                e os <strong>{counts.lots.toLocaleString('pt-BR')}</strong> lote
                {counts.lots === 1 ? '' : 's'} de validade que dependem {n === 1 ? 'dele' : 'deles'}
              </>
            )}
            .
          </p>
          <p>
            Os produtos continuam no Cadastro de produtos e os registros de quebra não são tocados.
            {all && ' Use isto para começar a importar uma base do zero.'}
          </p>

          {all && (
            <TextField
              label={`Para confirmar, digite ${CONFIRMATION}`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          )}
        </div>
      )}
    </Dialog>
  )
}
