import { useState } from 'react'
import type { LossRecordInitialDraft } from '@/features/breakage'
import type { ExpiryRow } from '../types'

/**
 * Gera a quebra de um lote vencido, a partir da tela de Validades.
 *
 * Fica fora da tela pela mesma razão de `useExpiryEditor`: quem lista não
 * precisa saber que existe um formulário de quebra aberto.
 *
 * A quantidade sugerida é o saldo do produto — o único número que o sistema
 * tem —, mas pode estar errada quando o produto tem mais de um lote com
 * validades diferentes, porque saldo é do produto, não do lote (ver
 * docs/dominio.md). Por isso o formulário de quebra abre para revisão, não
 * grava direto.
 *
 * Salvar a quebra some com o lote da lista de vencidos: `onSaved` exclui o
 * lote pelo mesmo caminho do botão de excluir, com o mesmo desfazer — se a
 * quantidade sugerida estava errada e sobrou saldo do lote, desfazer traz o
 * lote de volta em vez de forçar um novo lançamento manual.
 */
export function useGenerateBreakage(removeItems: (ids: string[]) => Promise<void>) {
  const [row, setRow] = useState<ExpiryRow | null>(null)

  const draft: LossRecordInitialDraft | undefined = row
    ? {
        product: {
          productId: row.productId,
          sku: row.sku,
          description: row.description,
          barcode: row.barcode,
          pendingProduct: false,
          stock: row.stock,
        },
        expiryDate: row.expiryDate,
        quantity: Math.max(1, row.stock),
        reasonLabel: 'Vencido',
      }
    : undefined

  function close() {
    setRow(null)
  }

  function saved() {
    const id = row?.id
    setRow(null)
    if (id) void removeItems([id])
  }

  return { isOpen: row !== null, draft, open: setRow, close, saved }
}
