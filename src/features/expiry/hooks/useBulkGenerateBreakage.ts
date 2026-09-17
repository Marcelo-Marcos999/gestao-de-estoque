import { useCallback, useState } from 'react'
import { createLossRecordsByReasonLabel, type LossRecordDraft } from '@/features/breakage'
import type { ExpiryRow } from '../types'

/**
 * Envia vários lotes vencidos para a quebra de uma vez, sem abrir um
 * formulário por item.
 *
 * Diferente de `useGenerateBreakage` (um lote só, com revisão antes de
 * salvar): aqui o motivo não precisa ser perguntado — todo lote elegível já
 * está na faixa "venceu", e "venceu no estoque" **é** o motivo, por si só
 * (ver docs/dominio.md). A quantidade segue a mesma regra do caminho de um
 * lote só: o saldo do produto, o único número que o sistema tem.
 *
 * Some com os lotes enviados pelo mesmo caminho do botão de excluir, com o
 * mesmo desfazer — se o saldo sugerido estava errado, desfazer traz o lote
 * de volta para revisão manual, em vez de forçar um lançamento novo.
 */
export function useBulkGenerateBreakage(
  removeItems: (ids: string[]) => Promise<void>,
  createdBy: string,
) {
  const [sending, setSending] = useState(false)

  const send = useCallback(
    async (rows: ExpiryRow[]) => {
      const vencidos = rows.filter((row) => row.situation === 'venceu')
      if (vencidos.length === 0) return

      setSending(true)

      const drafts: Omit<LossRecordDraft, 'reasonId'>[] = vencidos.map((row) => ({
        productId: row.productId,
        sku: row.sku,
        description: row.description,
        barcode: row.barcode,
        pendingProduct: false,
        expiryDate: row.expiryDate,
        quantity: Math.max(1, row.stock),
        originId: '',
        note: '',
        attachments: [],
      }))

      await createLossRecordsByReasonLabel(drafts, 'Vencido', createdBy)
      await removeItems(vencidos.map((row) => row.id))

      setSending(false)
    },
    [removeItems, createdBy],
  )

  return { sending, send }
}
