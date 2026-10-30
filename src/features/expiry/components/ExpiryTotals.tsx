import { formatMoney } from '@/shared/lib/money'
import { TotalTiles } from '@/shared/ui/TotalTiles'
import { sumExpiryTotals } from '../totals'
import type { ExpiryRow } from '../types'

const plural = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'produto' : 'produtos'}`

/**
 * O valor em jogo nos lotes mostrados agora (filtros aplicados): quanto está
 * parado no estoque e quanto disso corre risco de virar perda. Clicar em
 * "Venceu" nos cartões de situação, por exemplo, mostra aqui o custo do que já
 * venceu. Sem lotes, não aparece.
 */
export function ExpiryTotals({ rows }: { rows: ExpiryRow[] }) {
  if (rows.length === 0) return null

  const totals = sumExpiryTotals(rows)

  return (
    <TotalTiles
      tiles={[
        { label: 'Custo em estoque', value: formatMoney(totals.cost), hint: plural(totals.products) },
        {
          label: 'Custo em risco de perda',
          value: formatMoney(totals.atRisk),
          hint: `${plural(totals.productsAtRisk)} com lote vencido ou que vence antes de vender`,
        },
      ]}
    />
  )
}
