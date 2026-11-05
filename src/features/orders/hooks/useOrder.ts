import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/shared/lib/http'
import { getOrder } from '../api'
import type { Order } from '../types'

/**
 * Um pedido aberto na tela.
 *
 * Toda ação (item novo, fechar, reabrir…) devolve o pedido inteiro já recalculado,
 * e a tela o coloca aqui com `setOrder`: o total que aparece é sempre o do servidor,
 * sem uma segunda ida para reler.
 */
export function useOrder(id: string | undefined) {
  const [loaded, setLoaded] = useState<{ id: string; order: Order } | null>(null)
  const [failed, setFailed] = useState<{ id: string; notFound: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getOrder(id)
      .then((order) => {
        if (cancelled) return
        setFailed(null)
        setLoaded({ id, order })
      })
      .catch((erro) => {
        if (!cancelled) setFailed({ id, notFound: erro instanceof ApiError && (erro.status === 404 || erro.status === 400) })
      })
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  const order = loaded !== null && loaded.id === id ? loaded.order : null
  const setOrder = useCallback((next: Order) => setLoaded({ id: next.id, order: next }), [])
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const status: 'loading' | 'ready' | 'notFound' | 'error' =
    order !== null
      ? 'ready'
      : failed !== null && failed.id === id
        ? failed.notFound
          ? 'notFound'
          : 'error'
        : 'loading'

  return { order, status, setOrder, reload }
}
