import { useEffect, useState } from 'react'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { ALL_STORES, listStores, type StoreOption } from '@/shared/lib/stores'
import { storageKey } from '@/shared/lib/storage'

export interface StoreScope {
  stores: StoreOption[]
  /** A escolha vigente: "todas" ou o id de uma loja que ainda existe. */
  filter: string
  setFilter: (filter: string) => void
  /** Mostra o filtro e o nome da loja em cada registro: só faz sentido com mais de uma loja. */
  multi: boolean
  /**
   * O que mandar ao servidor (`?loja=…`). Vazio para o operador, que só enxerga a
   * própria loja — a RLS garante, e o parâmetro nem é enviado.
   */
  param: string
}

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * De quais lojas uma tela mostra registros.
 *
 * O administrador vê as lojas todas da conta (como o banco define) e pode
 * filtrar por uma; o operador, só a própria. A escolha é lembrada por tela, como
 * todo filtro (ver CLAUDE.md) — e vira "todas" sozinha se a loja lembrada deixou
 * de existir, em vez de abrir uma lista vazia sem explicação.
 */
export function useStoreScope(screen: string, isAdmin: boolean): StoreScope {
  const [stored, setFilter] = usePersistedState<string>(storageKey('loja', screen), ALL_STORES, isString)
  const [stores, setStores] = useState<StoreOption[]>([])

  useEffect(() => {
    if (!isAdmin) return

    let cancelled = false
    listStores()
      .then((list) => {
        if (!cancelled) setStores(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const known = stored === ALL_STORES || stores.length === 0 || stores.some((s) => s.id === stored)
  const filter = known ? stored : ALL_STORES

  return {
    stores,
    filter,
    setFilter,
    multi: isAdmin && stores.length > 1,
    param: isAdmin ? `?loja=${filter}` : '',
  }
}
