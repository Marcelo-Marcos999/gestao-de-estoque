import { useCallback, useEffect, useState } from 'react'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'
import { listOrders } from '../api'
import type { OrderQuery, OrderSummary, StatusFilter } from '../types'

export type ListStatus = 'loading' | 'error' | 'ready'

/** Quantos pedidos vêm por vez; "Mostrar mais" soma outro tanto. */
const PAGE_SIZE = 50

const FILTERS_KEY = storageKey('filtros', 'pedidos')
const NO_FILTERS: OrderQuery = { search: '', status: 'all' }
const STATUSES: StatusFilter[] = ['all', 'open', 'closed']

/** Descarta um registro gravado fora de formato em vez de quebrar a tela. */
function isOrderQuery(value: unknown): value is OrderQuery {
  if (typeof value !== 'object' || value === null) return false
  const { search, status } = value as Record<string, unknown>
  return typeof search === 'string' && STATUSES.includes(status as StatusFilter)
}

/**
 * Estado da lista de Pedidos: filtros lembrados entre sessões (ver CLAUDE.md) e a
 * busca no servidor.
 *
 * A busca roda NO SERVIDOR: pedidos só se acumulam (cinquenta por dia somam
 * milhares), então não dá para baixar todos e filtrar aqui como na Auditoria.
 * O servidor devolve os mais novos; "Mostrar mais" pede um limite maior.
 */
export function useOrderList(
  /** `?loja=…` do escopo de loja da tela (vazio para o operador). */
  storeParam = '',
) {
  const [filters, setFilters] = usePersistedState<OrderQuery>(FILTERS_KEY, NO_FILTERS, isOrderQuery)
  // Sem espera, cada tecla da busca iria ao servidor. Apagar a busca, porém, vale na hora:
  // esperar deixaria a lista da busca antiga na tela, dizendo "nenhum pedido" para um
  // campo que já está vazio.
  const debounced = useDebouncedValue(filters.search, 300)
  const search = filters.search.trim() === '' ? '' : debounced

  // O limite pertence a UMA busca: trocar filtro ou loja volta à primeira página, sem
  // um efeito que o zere (mesma ideia da paginação da Auditoria).
  const queryKey = `${storeParam}|${search.trim()}|${filters.status}`
  const [more, setMore] = useState({ key: queryKey, limit: PAGE_SIZE })
  const limit = more.key === queryKey ? more.limit : PAGE_SIZE

  const [result, setResult] = useState<{ key: string; orders: OrderSummary[]; total: number } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    listOrders(storeParam, { search, status: filters.status }, limit)
      .then(({ orders, total }) => {
        if (cancelled) return
        setFailedKey(null)
        setResult({ key: queryKey, orders, total })
      })
      .catch(() => {
        if (!cancelled) setFailedKey(queryKey)
      })
    return () => {
      cancelled = true
    }
  }, [storeParam, search, filters.status, queryKey, limit, reloadKey])

  // Ao pedir "mostrar mais" a lista antiga continua na tela até a nova chegar; só uma
  // BUSCA diferente volta ao esqueleto, porque ali a lista antiga seria a errada.
  const status: ListStatus =
    failedKey === queryKey ? 'error' : result?.key === queryKey ? 'ready' : 'loading'

  const setSearch = useCallback(
    (text: string) => setFilters((current) => ({ ...current, search: text })),
    [setFilters],
  )
  const setStatus = useCallback(
    (next: StatusFilter) => setFilters((current) => ({ ...current, status: next })),
    [setFilters],
  )
  const clearFilters = useCallback(() => setFilters(NO_FILTERS), [setFilters])
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])
  const showMore = useCallback(() => setMore({ key: queryKey, limit: limit + PAGE_SIZE }), [queryKey, limit])

  return {
    filters,
    orders: result?.key === queryKey ? result.orders : [],
    total: result?.key === queryKey ? result.total : 0,
    status,
    isFiltered: search.trim() !== '' || filters.status !== 'all',
    setSearch,
    setStatus,
    clearFilters,
    reload,
    showMore,
  }
}
