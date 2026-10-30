import { apiFetch } from '@/shared/lib/http'

/** Uma loja da conta. No sistema, o login **é** a loja (ver docs/modelo-de-dados.md). */
export interface StoreOption {
  id: string
  name: string
}

/** Valor do filtro de loja: "todas", ou o id de uma loja. */
export const ALL_STORES = 'todas'

/**
 * As lojas da conta, para o filtro do administrador. `GET /lojas` é só dele; o
 * operador não chama isto (ver `useStoreScope`).
 */
export async function listStores(): Promise<StoreOption[]> {
  const lojas = await apiFetch<Array<{ id: string; nome: string }>>('/lojas')
  return lojas.map((l) => ({ id: l.id, name: l.nome }))
}
