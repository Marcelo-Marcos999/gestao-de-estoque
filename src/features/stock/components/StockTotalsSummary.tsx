import { TotalTiles } from '@/shared/ui/TotalTiles'
import { formatMoney } from '@/shared/lib/money'
import type { StockTotals } from '../totals'

/**
 * Quanto vale o estoque mostrado agora: soma de saldo × custo e saldo × venda
 * de cada produto na lista, com os filtros aplicados.
 */
export function StockTotalsSummary({ cost, sale }: StockTotals) {
  return (
    <TotalTiles
      tiles={[
        { label: 'Total de custo', value: formatMoney(cost) },
        { label: 'Total de venda', value: formatMoney(sale) },
      ]}
    />
  )
}
