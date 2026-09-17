import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteProducts, restoreProducts } from '../api'
import type { Product } from '../types'

/**
 * Exclusão em lote do cadastro, com desfazer — mesmo padrão de Quebra e
 * Validades: sem confirmação antes, porque perguntar "tem certeza?" a cada
 * exclusão de rotina treina a pessoa a confirmar sem ler (ver
 * docs/dominio.md).
 */
export function useProductDeletion(onChanged: () => void) {
  const [undoable, setUndoable] = useState<Product[]>([])
  const undoTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const removeItems = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return

      const removed = await deleteProducts(ids)
      if (removed.length === 0) return

      setUndoable(removed)
      onChanged()

      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
      undoTimer.current = window.setTimeout(() => setUndoable([]), 8000)
    },
    [onChanged],
  )

  const undo = useCallback(async () => {
    if (undoable.length === 0) return

    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    const voltando = undoable
    setUndoable([])
    await restoreProducts(voltando)
    onChanged()
  }, [undoable, onChanged])

  const dismissUndo = useCallback(() => {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    setUndoable([])
  }, [])

  return { undoable, removeItems, undo, dismissUndo }
}
