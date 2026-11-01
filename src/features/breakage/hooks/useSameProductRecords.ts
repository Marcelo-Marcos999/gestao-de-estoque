import { useEffect, useState } from 'react'
import type { ChosenProduct } from '@/features/products'
import { loadRecordsOfProduct } from '../api'
import type { LossRecord } from '../types'

/**
 * Os registros que a loja já tem do produto escolhido, para o formulário avisar
 * antes de salvar. Informativo: se a consulta falhar, o formulário segue sem o
 * aviso, porque uma dica não vale impedir o registro de uma perda.
 *
 * O resultado guarda de qual produto ele é; trocar de produto deixa de mostrar o
 * aviso do anterior no mesmo quadro, sem um efeito que zere o estado.
 */
export function useSameProductRecords(
  product: ChosenProduct | null,
  /** A loja onde o registro será gravado, quando não é a do próprio login. */
  storeId: string | undefined,
  /** O registro em edição não conta como "outro registro". */
  ignoreId: string | undefined,
): LossRecord[] {
  const productId = product?.productId ?? ''
  const sku = product?.sku ?? ''
  const barcode = product?.barcode ?? ''
  const key = `${productId}|${sku}|${barcode}|${storeId ?? ''}`

  const [loaded, setLoaded] = useState<{ key: string; records: LossRecord[] } | null>(null)

  useEffect(() => {
    if (!productId && !sku && !barcode) return

    let cancelled = false
    loadRecordsOfProduct({ productId, sku, barcode }, storeId ? `?loja=${storeId}` : '')
      .then((records) => {
        if (!cancelled) setLoaded({ key, records })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [key, productId, sku, barcode, storeId])

  if (!loaded || loaded.key !== key) return []
  return loaded.records.filter((record) => record.id !== ignoreId)
}
