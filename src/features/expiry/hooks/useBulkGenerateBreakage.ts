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
 * (ver docs/dominio.md). A origem, ao contrário, não se deduz e é obrigatória:
 * a página pergunta uma vez e passa para `confirm`. A quantidade segue a mesma
 * regra do caminho de um lote só: o saldo do produto, o único número que o
 * sistema tem.
 *
 * O envio acontece em dois tempos: `ask` guarda os lotes e abre a pergunta da
 * origem; `confirm` cria os registros. Os lotes ficam aqui enquanto a pergunta
 * está aberta, e não na página, para ela não passar a cuidar de mais um estado.
 *
 * Some com os lotes enviados pelo mesmo caminho do botão de excluir, com o
 * mesmo desfazer — se o saldo sugerido estava errado, desfazer traz o lote
 * de volta para revisão manual, em vez de forçar um lançamento novo.
 */
export function useBulkGenerateBreakage(
  removeItems: (ids: string[]) => Promise<void>,
  /** Chamado ao enviar, para a página limpar a seleção que acabou de virar quebra. */
  onSent: () => void,
) {
  const [waiting, setWaiting] = useState<ExpiryRow[] | null>(null)

  const ask = useCallback((rows: ExpiryRow[]) => setWaiting(rows), [])
  const cancel = useCallback(() => setWaiting(null), [])

  /**
   * Devolve a mensagem de erro, ou `null` quando deu certo. O diálogo fica
   * aberto até lá: fechá-lo antes esconderia uma falha de quem acabou de
   * mandar centenas de lotes e acha que foram.
   */
  const confirm = useCallback(
    async (originId: string): Promise<string | null> => {
      const vencidos = (waiting ?? []).filter((row) => row.situation === 'venceu')
      if (vencidos.length === 0) {
        setWaiting(null)
        return null
      }

      const drafts: Omit<LossRecordDraft, 'reasonId'>[] = vencidos.map((row) => ({
        productId: row.productId,
        sku: row.sku,
        description: row.description,
        barcode: row.barcode,
        pendingProduct: false,
        expiryDate: row.expiryDate,
        quantity: Math.max(1, row.stock),
        originId,
        note: '',
        attachments: [],
        storeId: row.storeId,
      }))

      try {
        await createLossRecordsByReasonLabel(drafts, 'Vencido')
      } catch (erro) {
        return erro instanceof Error ? erro.message : 'Não foi possível enviar para a quebra.'
      }

      // Os registros já existem: tirar os lotes da lista é o que falta. Se isto
      // falhar, os lotes ficam e a quebra também — melhor que o contrário.
      onSent()
      setWaiting(null)
      await removeItems(vencidos.map((row) => row.id))
      return null
    },
    [waiting, removeItems, onSent],
  )

  return { waiting, ask, cancel, confirm }
}
