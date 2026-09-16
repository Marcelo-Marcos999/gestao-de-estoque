import type { StockTotals } from '../totals'
import styles from './StockTotalsSummary.module.css'

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Quanto vale o estoque mostrado agora: soma de saldo × custo e saldo × venda
 * de cada produto na lista, com os filtros aplicados.
 *
 * Só informativo — sem clique, diferente dos cartões de situação das
 * Validades — porque aqui não há uma segunda faixa para filtrar por trás do
 * número; é o mesmo total que a lista abaixo já mostra, resumido.
 */
export function StockTotalsSummary({ cost, sale }: StockTotals) {
  return (
    <div className={styles.tiles}>
      <div className={styles.tile}>
        <span className={styles.label}>Total de custo</span>
        <span className={styles.value}>{money(cost)}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>Total de venda</span>
        <span className={styles.value}>{money(sale)}</span>
      </div>
    </div>
  )
}
