import { useEffect, useState } from 'react'
import { loadItemsOfProduct } from '../api'
import type { ExpiryItem } from '../types'

/**
 * Os lotes que a loja já acompanha do produto escolhido, para avisar antes de
 * criar mais um. É informativo: se a consulta falhar, a tela segue sem o aviso em
 * vez de impedir o cadastro por causa de uma dica.
 *
 * O resultado guarda de qual produto ele é. Trocar de produto, então, deixa de
 * mostrar o aviso do anterior no mesmo instante, sem um efeito que zere o estado
 * (e sem o quadro em que o aviso de um produto aparece sob o nome de outro).
 */
export function useLotsOfProduct(productId: string | null): ExpiryItem[] {
  const [loaded, setLoaded] = useState<{ productId: string; items: ExpiryItem[] } | null>(null)

  useEffect(() => {
    if (!productId) return

    let cancelled = false
    loadItemsOfProduct(productId)
      .then((items) => {
        if (!cancelled) setLoaded({ productId, items })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [productId])

  return loaded && loaded.productId === productId ? loaded.items : []
}
