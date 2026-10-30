/**
 * Período do relatório de saídas, em dias.
 *
 * É a janela que o arquivo importado cobre, e entra direto na previsão de
 * quantos dias o estoque leva para zerar. Errar esse número desloca todas as
 * situações de uma vez, então ele é do usuário — quem exporta o relatório é
 * quem sabe o intervalo — e fica gravado no login dele, no banco
 * (`PATCH /conta/preferencias`), para valer em qualquer aparelho.
 *
 * Quem lê e grava é o hook `usePeriodDays`; aqui ficam só a chave da cópia local,
 * o padrão e a validação, que ele e qualquer futura tela de configurações
 * compartilham.
 */
import { storageKey } from '@/shared/lib/storage'

/**
 * Cópia local do valor, por login. Serve para a tela já nascer com o número certo
 * enquanto o servidor responde (e para abrir sem rede); a verdade é a do banco.
 * Por login, e não por navegador, porque duas pessoas podem usar o mesmo aparelho.
 */
export function periodKey(userId: string): string {
  return storageKey('periodo', userId)
}

/** Um ano comercial, que é o intervalo mais comum desses relatórios. */
export const DEFAULT_PERIOD_DAYS = 390

/** Acima de 10 anos é erro de digitação; o servidor recusa o mesmo valor. */
export const MAX_PERIOD_DAYS = 3650

/** Um valor fora de faixa quebraria a divisão da previsão em silêncio. */
export function isPeriodDays(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= MAX_PERIOD_DAYS
  )
}
