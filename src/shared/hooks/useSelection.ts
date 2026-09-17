import { useCallback, useState } from 'react'

/**
 * Seleção múltipla por id, para excluir vários registros sem abrir cada um.
 *
 * Genérico porque a mecânica é sempre a mesma em toda tela com registro —
 * só a lista de ids visíveis muda (ver CLAUDE.md, "arquitetura").
 */
export function useSelection<T extends string = string>(visibleIds: T[]) {
  const [selection, setSelection] = useState<ReadonlySet<T>>(() => new Set())

  const toggle = useCallback((id: T) => {
    setSelection((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => setSelection(new Set(visibleIds)), [visibleIds])

  const clear = useCallback(() => setSelection(new Set()), [])

  return { selection, toggle, selectAll, clear, replace: setSelection }
}
