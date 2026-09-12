import { useCallback } from 'react'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { DEFAULT_PERIOD_DAYS, PERIOD_KEY, isPeriodDays } from './period'

/**
 * O período do relatório de saídas, editável.
 *
 * Sobre `usePersistedState`, e não sobre uma leitura direta do storage, porque
 * o valor é lido em mais de um lugar ao mesmo tempo: sem o aviso entre
 * instâncias, a previsão continuaria calculada pelo número velho até a página
 * ser recarregada.
 *
 * A gravação normaliza antes de guardar — um período zerado ou negativo faria
 * a divisão da previsão devolver silenciosamente um prazo sem sentido.
 */
export function usePeriodDays(): [number, (days: number) => void] {
  const [days, setDays] = usePersistedState<number>(
    PERIOD_KEY,
    DEFAULT_PERIOD_DAYS,
    isPeriodDays,
  )

  const update = useCallback(
    (value: number) => setDays(Math.max(1, Math.floor(value))),
    [setDays],
  )

  return [days, update]
}
