import { useCallback, useEffect, useState } from 'react'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'
import { listStockRows } from '../api'
import type { StockQuery, StockRow } from '../types'

export type ListStatus = 'loading' | 'error' | 'ready'

const FILTERS_KEY = storageKey('filtros', 'estoque')

const NO_FILTERS: StockQuery = { search: '', onlyPending: false }

/** Descarta um registro gravado fora de formato em vez de quebrar a tela. */
function isStockQuery(value: unknown): value is StockQuery {
  if (typeof value !== 'object' || value === null) return false

  const { search, onlyPending } = value as Record<string, unknown>
  return typeof search === 'string' && typeof onlyPending === 'boolean'
}

/**
 * Estado da tela de Estoque: filtros lembrados entre sessões (ver CLAUDE.md) e
 * a busca dos dados que eles produzem.
 */
export function useStockList() {
  const [filters, setFilters] = usePersistedState<StockQuery>(FILTERS_KEY, NO_FILTERS, isStockQuery)

  const debouncedSearch = useDebouncedValue(filters.search, 250)
  const queryKey = `${debouncedSearch}|${filters.onlyPending}`

  const [result, setResult] = useState<{ key: string; items: StockRow[]; total: number } | null>(
    null,
  )
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    listStockRows({ search: debouncedSearch, onlyPending: filters.onlyPending })
      .then((page) => {
        if (cancelled) return
        setFailedKey(null)
        setResult({ key: queryKey, items: page.items, total: page.total })
      })
      .catch(() => {
        if (!cancelled) setFailedKey(queryKey)
      })

    return () => {
      cancelled = true
    }
  }, [queryKey, debouncedSearch, filters.onlyPending, reloadKey])

  const status: ListStatus =
    failedKey === queryKey ? 'error' : result === null ? 'loading' : 'ready'

  const rows = result?.items ?? []
  const matching = result?.total ?? 0

  const setSearch = useCallback(
    (search: string) => setFilters((current) => ({ ...current, search })),
    [setFilters],
  )

  const setOnlyPending = useCallback(
    (onlyPending: boolean) => setFilters((current) => ({ ...current, onlyPending })),
    [setFilters],
  )

  const clearFilters = useCallback(() => setFilters(NO_FILTERS), [setFilters])
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const isFiltered = debouncedSearch.trim() !== '' || filters.onlyPending

  return {
    filters,
    rows,
    matching,
    status,
    isFiltered,
    setSearch,
    setOnlyPending,
    clearFilters,
    reload,
  }
}
