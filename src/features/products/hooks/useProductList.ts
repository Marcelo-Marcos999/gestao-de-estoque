import { useCallback, useEffect, useState } from 'react'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'
import { countProducts, listProducts } from '../api'
import type { Product, ProductQuery } from '../types'

export type ListStatus = 'loading' | 'error' | 'ready'

const FILTERS_KEY = storageKey('filtros', 'produtos')

const NO_FILTERS: ProductQuery = { search: '', onlyWithoutBarcode: false, onlyPending: false }

/** Descarta um registro gravado fora de formato em vez de quebrar a tela. */
function isProductQuery(value: unknown): value is ProductQuery {
  if (typeof value !== 'object' || value === null) return false

  const { search, onlyWithoutBarcode, onlyPending } = value as Record<string, unknown>
  return (
    typeof search === 'string' &&
    typeof onlyWithoutBarcode === 'boolean' &&
    typeof onlyPending === 'boolean'
  )
}

/**
 * Estado da listagem: filtros lembrados entre sessões (ver CLAUDE.md) e a
 * busca dos dados que eles produzem.
 *
 * Fica fora do componente para a página cuidar só de desenhar.
 */
export function useProductList() {
  const [filters, setFilters] = usePersistedState<ProductQuery>(
    FILTERS_KEY,
    NO_FILTERS,
    isProductQuery,
  )

  // Sem espera, cada tecla dispararia uma varredura da base inteira.
  const debouncedSearch = useDebouncedValue(filters.search, 250)

  /**
   * Identifica a consulta em curso. Guardar o resultado junto da chave que o
   * produziu permite derivar o estado da tela por comparação, em vez de
   * gravar "carregando" antes de cada busca — o que custaria um render a mais
   * e faria a lista piscar a cada tecla.
   */
  const queryKey = `${debouncedSearch}|${filters.onlyWithoutBarcode}|${filters.onlyPending}`

  const [result, setResult] = useState<{ key: string; items: Product[]; total: number } | null>(
    null,
  )
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    listProducts({
      search: debouncedSearch,
      onlyWithoutBarcode: filters.onlyWithoutBarcode,
      onlyPending: filters.onlyPending,
    })
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
  }, [queryKey, debouncedSearch, filters.onlyWithoutBarcode, filters.onlyPending, reloadKey])

  useEffect(() => {
    let cancelled = false

    countProducts().then((count) => {
      if (!cancelled) setTotal(count)
    })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Recarregar depois de salvar mantém a lista anterior visível até a nova
  // chegar: um esqueleto piscando ao fechar o formulário é pior que 200ms de
  // dado levemente velho.
  const status: ListStatus =
    failedKey === queryKey ? 'error' : result === null ? 'loading' : 'ready'

  const products = result?.items ?? []
  const matching = result?.total ?? 0

  const setSearch = useCallback(
    (search: string) => setFilters((current) => ({ ...current, search })),
    [setFilters],
  )

  const setOnlyWithoutBarcode = useCallback(
    (onlyWithoutBarcode: boolean) =>
      setFilters((current) => ({ ...current, onlyWithoutBarcode })),
    [setFilters],
  )

  const setOnlyPending = useCallback(
    (onlyPending: boolean) => setFilters((current) => ({ ...current, onlyPending })),
    [setFilters],
  )

  const clearFilters = useCallback(() => setFilters(NO_FILTERS), [setFilters])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  // Usa o valor com atraso, não o que está sendo digitado: senão a contagem
  // trocaria de formato antes de a lista mudar.
  const isFiltered =
    debouncedSearch.trim() !== '' || filters.onlyWithoutBarcode || filters.onlyPending

  return {
    filters,
    products,
    matching,
    total,
    status,
    isFiltered,
    setSearch,
    setOnlyWithoutBarcode,
    setOnlyPending,
    clearFilters,
    reload,
  }
}
