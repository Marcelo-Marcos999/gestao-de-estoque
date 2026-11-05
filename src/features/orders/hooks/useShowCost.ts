import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

/**
 * "Mostrar custo": o vendedor só quer ver o custo (e a margem) quando vai negociar
 * desconto — e não com o cliente olhando por cima do ombro. Por isso nasce
 * ESCONDIDO e a escolha é lembrada. A mesma chave serve ao diálogo do item e à
 * página do pedido, e `usePersistedState` mantém os dois em sincronia.
 */
export function useShowCost() {
  return usePersistedState<boolean>(storageKey('mostrar-custo', 'pedidos'), false, isBoolean)
}
