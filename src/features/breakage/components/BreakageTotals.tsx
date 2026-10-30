import { formatMoney } from '@/shared/lib/money'
import { TotalTiles } from '@/shared/ui/TotalTiles'
import { sumLossTotals } from '../totals'
import type { LossRecord } from '../types'

/** O valor da perda dos registros mostrados agora (filtros aplicados). Sem registros, não aparece. */
export function BreakageTotals({ records }: { records: LossRecord[] }) {
  if (records.length === 0) return null

  const { cost, withoutCost } = sumLossTotals(records)

  return (
    <TotalTiles
      tiles={[
        {
          label: 'Total de custo da perda',
          value: formatMoney(cost),
          hint:
            withoutCost > 0
              ? `${withoutCost.toLocaleString('pt-BR')} ${
                  withoutCost === 1 ? 'registro' : 'registros'
                } sem custo, fora da soma`
              : undefined,
        },
      ]}
    />
  )
}
