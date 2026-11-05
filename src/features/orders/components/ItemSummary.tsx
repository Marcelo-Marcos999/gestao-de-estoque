import { formatMoney } from '@/shared/lib/money'
import { Alert } from '@/shared/ui/Alert'
import styles from './ItemSummary.module.css'

interface ItemFactsProps {
  /** Nulo: o produto não tem preço de venda no estoque da loja. */
  price: number | null
  /** Nulo enquanto a consulta ao estoque não voltou. */
  stock: number | null
  /** Nulo com o custo escondido. */
  cost: number | null
}

/** O que a loja tem do produto: preço de venda, saldo e (se pedido) o custo. */
export function ItemFacts({ price, stock, cost }: ItemFactsProps) {
  return (
    <div className={styles.facts} aria-label="Dados do produto na loja">
      <Fact label="Preço de venda" value={price !== null ? formatMoney(price) : '—'} />
      <Fact label="Em estoque" value={stock !== null ? `${stock.toLocaleString('pt-BR')} un` : '…'} />
      {cost !== null && <Fact label="Custo" value={formatMoney(cost)} />}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  )
}

interface ItemPreviewProps {
  total: number
  gross: number
  /** Custo do item inteiro; nulo com o custo escondido. */
  cost: number | null
  /** Total menos custo; nulo se não há como calcular. */
  margin: number | null
}

/** O total do item enquanto se digita (o que vale é o que o servidor grava). */
export function ItemPreview({ total, gross, cost, margin }: ItemPreviewProps) {
  return (
    <div className={styles.preview} aria-live="polite">
      <div className={styles.previewRow}>
        <span>Total do item</span>
        <strong className={styles.previewTotal}>{formatMoney(total)}</strong>
      </div>
      {total !== gross && (
        <span className={styles.previewNote}>
          Sem desconto: {formatMoney(gross)} · desconto de {formatMoney(gross - total)}
        </span>
      )}
      {cost !== null && margin !== null && (
        <span className={styles.previewNote}>
          Custo do item {formatMoney(cost)} · lucro {formatMoney(margin)}
          {total > 0 && ` (${((margin / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`}
        </span>
      )}
      {margin !== null && margin < 0 && <Alert tone="info">Com este desconto o item fica abaixo do custo.</Alert>}
    </div>
  )
}
