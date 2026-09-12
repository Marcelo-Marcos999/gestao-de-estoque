import { useCallback, useState } from 'react'
import { updateStockRow } from '../api'
import type { StockEdit } from '../components/StockRowDialog'
import type { StockRow } from '../types'

/**
 * Edição de uma linha de estoque: abrir, salvar, fechar.
 *
 * Mais simples que o editor de lote da tela de Validades — aqui não há o que
 * excluir nem desfazer, só corrigir os quatro números de um produto.
 */
export function useStockEditor(onChanged: () => void) {
  const [editing, setEditing] = useState<StockRow | null>(null)
  const [saving, setSaving] = useState(false)

  const close = useCallback(() => setEditing(null), [])

  const save = useCallback(
    async (edit: StockEdit) => {
      if (!editing) return

      setSaving(true)
      await updateStockRow(editing.productId, edit)
      setSaving(false)
      setEditing(null)
      onChanged()
    },
    [editing, onChanged],
  )

  return { editing, saving, open: setEditing, close, save }
}
