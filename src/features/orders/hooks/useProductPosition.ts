import { useEffect, useState } from 'react'
import { getProductPosition } from '../api'
import type { ProductPosition } from '../types'

/**
 * Saldo, preço de venda e custo do produto NA LOJA DO PEDIDO.
 *
 * O resultado guarda de qual produto é, e `position` só vale quando bate com o
 * produto atual: uma resposta atrasada do produto anterior nunca aparece ao lado do
 * seguinte. `null` enquanto a consulta não volta; `failed` se ela falhou.
 */
export function useProductPosition(orderId: string, productId: string | null) {
  const [result, setResult] = useState<{ key: string; position: ProductPosition | null } | null>(null)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    getProductPosition(orderId, productId)
      .then((position) => {
        if (!cancelled) setResult({ key: productId, position })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: productId, position: null })
      })
    return () => {
      cancelled = true
    }
  }, [orderId, productId])

  const settled = result !== null && result.key === productId
  return { position: settled ? result.position : null, failed: settled && result.position === null }
}
