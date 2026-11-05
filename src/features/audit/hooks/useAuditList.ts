import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'
import { listAuditRows, matchesQuery } from '../api'
import { rowDifference } from '../compute'
import type { AuditQuery, AuditRow } from '../types'

export type ListStatus = 'loading' | 'error' | 'ready'

const FILTERS_KEY = storageKey('filtros', 'auditoria')
const NO_FILTERS: AuditQuery = { search: '', onlyDifferences: false }

/** Descarta um registro gravado fora de formato em vez de quebrar a tela. */
function isAuditQuery(value: unknown): value is AuditQuery {
  if (typeof value !== 'object' || value === null) return false
  const { search, onlyDifferences } = value as Record<string, unknown>
  return typeof search === 'string' && typeof onlyDifferences === 'boolean'
}

/**
 * Estado da Auditoria: filtros lembrados entre sessões (ver CLAUDE.md) e a busca
 * das contagens.
 *
 * O servidor devolve a loja inteira e o filtro roda aqui: uma contagem tem
 * centenas de linhas, não dezenas de milhares, e filtrar no cliente deixa a busca
 * instantânea enquanto a pessoa digita, sem uma ida ao servidor por tecla.
 */
export function useAuditList(
  /** `?loja=…` do escopo de loja da tela (vazio para o operador). */
  storeParam = '',
) {
  const [filters, setFilters] = usePersistedState<AuditQuery>(FILTERS_KEY, NO_FILTERS, isAuditQuery)
  const [result, setResult] = useState<{ key: string; items: AuditRow[] } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    listAuditRows(storeParam)
      .then((items) => {
        if (cancelled) return
        setFailedKey(null)
        setResult({ key: storeParam, items })
      })
      .catch(() => {
        if (!cancelled) setFailedKey(storeParam)
      })
    return () => {
      cancelled = true
    }
  }, [storeParam, reloadKey])

  const status: ListStatus = failedKey === storeParam ? 'error' : result === null ? 'loading' : 'ready'
  const all = useMemo(() => result?.items ?? [], [result])
  const rows = useMemo(
    () => all.filter((row) => matchesQuery(row, filters, rowDifference(row))),
    [all, filters],
  )

  const setSearch = useCallback(
    (search: string) => setFilters((current) => ({ ...current, search })),
    [setFilters],
  )
  const setOnlyDifferences = useCallback(
    (onlyDifferences: boolean) => setFilters((current) => ({ ...current, onlyDifferences })),
    [setFilters],
  )
  const clearFilters = useCallback(() => setFilters(NO_FILTERS), [setFilters])
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const isFiltered = filters.search.trim() !== '' || filters.onlyDifferences

  return { filters, all, rows, status, isFiltered, setSearch, setOnlyDifferences, clearFilters, reload }
}
