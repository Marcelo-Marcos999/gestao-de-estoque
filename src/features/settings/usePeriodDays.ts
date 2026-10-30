import { useCallback, useEffect } from 'react'
import { useAuth } from '@/features/auth'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { getPeriodPreference, savePeriodPreference } from './periodApi'
import { DEFAULT_PERIOD_DAYS, MAX_PERIOD_DAYS, isPeriodDays, periodKey } from './period'

/**
 * O período do relatório de saídas, editável e gravado no login.
 *
 * A verdade é a do banco: ao abrir, o valor do servidor vence. Por cima fica uma
 * cópia local por login (`usePersistedState`) só para a tela não piscar o padrão
 * enquanto a resposta chega. Sobre `usePersistedState`, e não sobre um estado
 * solto, porque o valor é lido em mais de um lugar ao mesmo tempo: sem o aviso
 * entre instâncias, a previsão continuaria calculada pelo número velho.
 *
 * `update` devolve se o servidor aceitou. Em falha o número novo vale nesta tela
 * mesmo assim — quem digitou espera vê-lo —, mas devolve `false` para a tela
 * avisar que ele não ficou guardado: calar deixaria o valor antigo voltar na
 * próxima abertura sem ninguém entender por quê.
 *
 * A gravação normaliza antes de guardar — um período zerado ou negativo faria
 * a divisão da previsão devolver silenciosamente um prazo sem sentido.
 */
export function usePeriodDays(): [number, (days: number) => Promise<boolean>] {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [days, setDays] = usePersistedState<number>(
    periodKey(userId),
    DEFAULT_PERIOD_DAYS,
    isPeriodDays,
  )

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    getPeriodPreference()
      .then((saved) => {
        if (!cancelled && saved !== null && isPeriodDays(saved)) setDays(saved)
      })
      // Sem rede, vale a cópia local: a previsão continua funcionando.
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [userId, setDays])

  const update = useCallback(
    async (value: number): Promise<boolean> => {
      const next = Math.min(MAX_PERIOD_DAYS, Math.max(1, Math.floor(value)))
      setDays(next)

      try {
        await savePeriodPreference(next)
        return true
      } catch {
        return false
      }
    },
    [setDays],
  )

  return [days, update]
}
