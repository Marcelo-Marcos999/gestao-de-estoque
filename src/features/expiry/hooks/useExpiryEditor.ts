import { useCallback, useEffect, useRef, useState } from 'react'
import type { IsoDate } from '@/shared/lib/date'
import { deleteExpiryItems, restoreExpiryItems, updateExpiryItem } from '../api'
import type { ExpiryItem, ExpiryRow } from '../types'

/**
 * Edição de um lote: abrir, salvar a validade, excluir e desfazer.
 *
 * Fica fora da tela porque não é assunto da lista — quem lista não precisa
 * saber que existe um diálogo aberto, e quem edita não precisa saber como a
 * lista é buscada.
 *
 * A exclusão não pergunta antes: perguntar "tem certeza?" a cada exclusão de
 * rotina treina a pessoa a confirmar sem ler. O desfazer resolve o engano de
 * verdade, e só custa quando ele acontece (ver docs/dominio.md).
 */
export function useExpiryEditor(onChanged: () => void) {
  const [editing, setEditing] = useState<ExpiryRow | null>(null)
  const [saving, setSaving] = useState(false)

  /** Últimos lotes excluídos, enquanto o desfazer ainda está de pé. */
  const [undoable, setUndoable] = useState<ExpiryItem[]>([])
  const undoTimer = useRef<number | null>(null)

  // Sem esta limpeza, um temporizador sobreviveria à saída da tela e tentaria
  // escrever estado de um componente já desmontado.
  useEffect(() => {
    return () => {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const close = useCallback(() => setEditing(null), [])

  const save = useCallback(
    async (expiryDate: IsoDate | null) => {
      if (!editing) return

      setSaving(true)
      await updateExpiryItem(editing.id, expiryDate)
      setSaving(false)
      setEditing(null)
      onChanged()
    },
    [editing, onChanged],
  )

  const remove = useCallback(async () => {
    if (!editing) return

    setSaving(true)
    const removed = await deleteExpiryItems([editing.id])
    setSaving(false)
    setEditing(null)

    if (removed.length === 0) return
    setUndoable(removed)
    onChanged()

    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndoable([]), 8000)
  }, [editing, onChanged])

  const undo = useCallback(async () => {
    if (undoable.length === 0) return

    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    const voltando = undoable
    setUndoable([])
    await restoreExpiryItems(voltando)
    onChanged()
  }, [undoable, onChanged])

  const dismissUndo = useCallback(() => {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    setUndoable([])
  }, [])

  return { editing, saving, undoable, open: setEditing, close, save, remove, undo, dismissUndo }
}
