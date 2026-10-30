import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteProducts, restoreProducts } from '../api'
import type { Product } from '../types'

const FAILURE = 'Não foi possível excluir. Verifique a conexão e tente de novo.'

/**
 * Exclusão em lote do cadastro, com desfazer — mesmo padrão de Quebra e
 * Validades: sem confirmação antes, porque perguntar "tem certeza?" a cada
 * exclusão de rotina treina a pessoa a confirmar sem ler (ver
 * docs/dominio.md).
 *
 * Produto com estoque é a exceção: o servidor não o exclui sozinho (apagar o
 * produto levaria o estoque e os lotes de validade junto). Esses ficam
 * `pending` e a tela pergunta; só com a confirmação eles saem — e sem desfazer,
 * porque o estoque que sai junto não volta.
 *
 * Toda falha vira mensagem. Antes um produto que ficava para trás, ou uma
 * requisição que falhava, não dizia nada, e a tela parecia ignorar o clique.
 */
export function useProductDeletion(onChanged: () => void) {
  const [undoable, setUndoable] = useState<Product[]>([])
  /** Quantos produtos estão sendo excluídos agora (0 = nada em andamento). */
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Ids que ficaram por terem estoque, aguardando a pessoa decidir. */
  const [pending, setPending] = useState<string[]>([])
  const undoTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const removeItems = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return

      setBusy(ids.length)
      setError(null)
      setNotice(null)

      try {
        const { removed, keptIds } = await deleteProducts(ids)

        if (removed.length > 0) {
          setUndoable(removed)
          if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
          undoTimer.current = window.setTimeout(() => setUndoable([]), 8000)
        }
        setPending(keptIds)
      } catch {
        setError(FAILURE)
      } finally {
        setBusy(0)
        // Mesmo com erro: um lote anterior pode ter saído, e a lista tem de refletir isso.
        onChanged()
      }
    },
    [onChanged],
  )

  /** A pessoa confirmou: exclui os que ficaram, junto com o estoque e os lotes deles. */
  const confirmWithStock = useCallback(async () => {
    const ids = pending
    setPending([])
    if (ids.length === 0) return

    setBusy(ids.length)
    setError(null)

    try {
      const { removed } = await deleteProducts(ids, true)
      setNotice(
        `${removed.length.toLocaleString('pt-BR')} produto${removed.length === 1 ? '' : 's'} excluído${
          removed.length === 1 ? '' : 's'
        }, com o estoque e os lotes de validade.`,
      )
    } catch {
      setError(FAILURE)
    } finally {
      setBusy(0)
      onChanged()
    }
  }, [pending, onChanged])

  const undo = useCallback(async () => {
    if (undoable.length === 0) return

    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    const voltando = undoable
    setUndoable([])
    try {
      await restoreProducts(voltando)
    } catch {
      setError('Não foi possível desfazer. Verifique a conexão e tente de novo.')
    }
    onChanged()
  }, [undoable, onChanged])

  const dismissUndo = useCallback(() => {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    setUndoable([])
  }, [])

  return {
    undoable,
    removeItems,
    undo,
    dismissUndo,
    busy,
    error,
    notice,
    pending,
    confirmWithStock,
    dismissPending: () => setPending([]),
    dismissMessage: () => {
      setError(null)
      setNotice(null)
    },
  }
}

export type ProductDeletion = ReturnType<typeof useProductDeletion>
