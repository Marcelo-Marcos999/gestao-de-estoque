/**
 * Período do relatório de saídas, em dias.
 *
 * É a janela que o arquivo importado cobre, e entra direto na previsão de
 * quantos dias o estoque leva para zerar. Errar esse número desloca todas as
 * situações de uma vez, então ele é do usuário — quem exporta o relatório é
 * quem sabe o intervalo.
 *
 * Quem lê e grava é o hook `usePeriodDays`; aqui ficam só a chave, o padrão e
 * a validação, que ele e qualquer futura tela de configurações compartilham.
 */
import { storageKey } from '@/shared/lib/storage'

export const PERIOD_KEY = storageKey('periodo')

/** Um ano comercial, que é o intervalo mais comum desses relatórios. */
export const DEFAULT_PERIOD_DAYS = 390

/** Um valor fora de faixa quebraria a divisão da previsão em silêncio. */
export function isPeriodDays(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
}
