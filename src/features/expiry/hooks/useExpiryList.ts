import { useCallback, useEffect, useState } from 'react'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'
import { usePeriodDays } from '@/features/settings'
import { listExpiryItems, type ExpiryPage } from '../api'
import type { Situation } from '../situation'
import type { ExpiryQuery, ExpiryRow } from '../types'

export type ListStatus = 'loading' | 'error' | 'ready'

const FILTERS_KEY = storageKey('filtros', 'validades')

const NO_FILTERS: ExpiryQuery = { search: '', situations: [] }

const SITUATIONS: Situation[] = ['venceu', 'vence-antes', 'vende-antes', 'sem-estimativa']

/** Descarta registro fora de formato em vez de deixar a tela num estado impossível. */
function isExpiryQuery(value: unknown): value is ExpiryQuery {
  if (typeof value !== 'object' || value === null) return false

  const { search, situations } = value as Record<string, unknown>
  return (
    typeof search === 'string' &&
    Array.isArray(situations) &&
    situations.every((s) => SITUATIONS.includes(s as Situation))
  )
}

const EMPTY_COUNTS: ExpiryPage['counts'] = {
  venceu: 0,
  'vence-antes': 0,
  'vende-antes': 0,
  'sem-estimativa': 0,
}

/**
 * Estado da tela de validades: filtros lembrados entre sessões e a busca dos
 * dados que eles produzem.
 */
export function useExpiryList() {
  const [filters, setFilters] = usePersistedState<ExpiryQuery>(
    FILTERS_KEY,
    NO_FILTERS,
    isExpiryQuery,
  )

  const [result, setResult] = useState<{ key: string; page: ExpiryPage } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Sem espera, cada tecla dispararia uma varredura da base inteira.
  const debouncedSearch = useDebouncedValue(filters.search, 250)
  const [periodDays, setPeriodDays] = usePeriodDays()

  const queryKey = `${debouncedSearch}|${filters.situations.join(',')}|${periodDays}`

  useEffect(() => {
    let cancelled = false

    listExpiryItems({ search: debouncedSearch, situations: filters.situations }, periodDays)
      .then((page) => {
        if (cancelled) return
        setFailedKey(null)
        setResult({ key: queryKey, page })
      })
      .catch(() => {
        if (!cancelled) setFailedKey(queryKey)
      })

    return () => {
      cancelled = true
    }
  }, [queryKey, debouncedSearch, filters.situations, periodDays, reloadKey])

  const setSearch = useCallback(
    (search: string) => setFilters((current) => ({ ...current, search })),
    [setFilters],
  )

  /** Clicar num cartão liga e desliga aquela faixa. */
  const toggleSituation = useCallback(
    (situation: Situation) =>
      setFilters((current) => ({
        ...current,
        situations: current.situations.includes(situation)
          ? current.situations.filter((s) => s !== situation)
          : [...current.situations, situation],
      })),
    [setFilters],
  )

  const clearFilters = useCallback(() => setFilters(NO_FILTERS), [setFilters])
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const status: ListStatus =
    failedKey === queryKey ? 'error' : result === null ? 'loading' : 'ready'

  const isFiltered = debouncedSearch.trim() !== '' || filters.situations.length > 0

  return {
    filters,
    periodDays,
    setPeriodDays,
    rows: (result?.page.items ?? []) as ExpiryRow[],
    matching: result?.page.total ?? 0,
    overall: result?.page.overall ?? 0,
    counts: result?.page.counts ?? EMPTY_COUNTS,
    status,
    isFiltered,
    setSearch,
    toggleSituation,
    clearFilters,
    reload,
  }
}
