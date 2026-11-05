import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'
import { SortButton } from '@/shared/ui/SortButton'
import type { SortDir } from '@/shared/hooks/useSort'
import { formatMoney } from '@/shared/lib/money'
import {
  differenceKind,
  rowCostTotal,
  rowDifference,
  rowDifferenceValue,
  rowSaleTotal,
  type DifferenceKind,
} from '../compute'
import { rowKey, type AuditRow } from '../types'
import styles from './AuditTable.module.css'

export type AuditSortKey =
  | 'description'
  | 'stock'
  | 'outflow'
  | 'costPrice'
  | 'salePrice'
  | 'totalCost'
  | 'totalSale'
  | 'counted'
  | 'difference'
  | 'differenceValue'

interface AuditTableProps {
  rows: AuditRow[]
  /** O administrador, com mais de uma loja: mostra a loja de cada contagem. */
  showStore: boolean
  sortKey: AuditSortKey | null
  sortDir: SortDir | null
  onSort: (key: AuditSortKey) => void
  onOpenEntries: (row: AuditRow) => void
}

/** A situação sempre em palavras: o sinal do número sozinho se lê ao contrário. */
const KIND_LABEL: Record<DifferenceKind, string> = {
  falta: 'Falta',
  sobra: 'Sobra',
  confere: 'Confere',
}

function Difference({ row }: { row: AuditRow }) {
  const kind = differenceKind(row)
  return (
    <span className={styles.difference}>
      <span className={styles.number}>{rowDifference(row)}</span>
      <span className={styles.kind}>{KIND_LABEL[kind]}</span>
    </span>
  )
}

/**
 * A contagem ao lado de TODAS as colunas do estoque (estoque, saídas, custo,
 * venda e os dois totais), mais a diferença e o seu valor.
 *
 * São onze colunas: em tela larga a tabela rola para o lado em vez de espremer os
 * números; no celular cada linha vira um cartão com os mesmos dados rotulados.
 */
export function AuditTable({ rows, showStore, sortKey, sortDir, onSort, onOpenEntries }: AuditTableProps) {
  const sortProps = { activeKey: sortKey, activeDir: sortDir, onSort }

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.head}`}>
            <SortButton label="Produto" sortKey="description" {...sortProps} />
            <SortButton label="Estoque" sortKey="stock" {...sortProps} />
            <SortButton label="Saídas" sortKey="outflow" {...sortProps} />
            <SortButton label="Custo" sortKey="costPrice" {...sortProps} />
            <SortButton label="Venda" sortKey="salePrice" {...sortProps} />
            <SortButton label="Total custo" sortKey="totalCost" {...sortProps} />
            <SortButton label="Total venda" sortKey="totalSale" {...sortProps} />
            <SortButton label="Contagem" sortKey="counted" {...sortProps} />
            <SortButton label="Diferença" sortKey="difference" {...sortProps} />
            <SortButton label="Valor da diferença" sortKey="differenceValue" {...sortProps} />
            <span className={styles.srOnly}>Registros</span>
          </div>

          {rows.map((row) => (
            <div className={`${styles.row} ${styles.item}`} key={rowKey(row)}>
              <span className={styles.product}>
                <span className={styles.description} title={row.description}>
                  {row.description}
                </span>
                <span className={styles.codes}>
                  SKU {row.sku}
                  {row.barcode && ` · ${row.barcode}`}
                  {showStore && ` · ${row.storeName}`}
                </span>
                {!row.hasStock && (
                  <span className={styles.noStock}>Sem estoque lançado nesta loja: saldo 0</span>
                )}
              </span>

              <Cell label="Estoque" tier="main">
                {row.stock}
              </Cell>
              <Cell label="Saídas">{row.outflow}</Cell>
              <Cell label="Custo">{formatMoney(row.costPrice)}</Cell>
              <Cell label="Venda">{formatMoney(row.salePrice)}</Cell>
              <Cell label="Total custo">{formatMoney(rowCostTotal(row))}</Cell>
              <Cell label="Total venda">{formatMoney(rowSaleTotal(row))}</Cell>
              <Cell label="Contagem" tier="main" strong>
                {row.counted}
              </Cell>
              <Cell label="Diferença" tier="main">
                <Difference row={row} />
              </Cell>
              <Cell label="Valor da diferença" tier="value">
                {formatMoney(rowDifferenceValue(row))}
              </Cell>

              <Button variant="ghost" onClick={() => onOpenEntries(row)}>
                {row.entries.length} {row.entries.length === 1 ? 'registro' : 'registros'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Uma célula numérica. No celular não existe cabeçalho de coluna, então o rótulo
 * aparece junto do valor; na tabela larga ele fica escondido.
 *
 * `tier` só importa no celular, onde o cartão tem três níveis: os três números que
 * respondem à auditoria (`main`: estoque, contagem e diferença), o valor da
 * diferença (`value`, em destaque) e o resto dos dados do estoque (`extra`).
 */
function Cell({
  label,
  tier = 'extra',
  strong = false,
  children,
}: {
  label: string
  tier?: 'main' | 'value' | 'extra'
  strong?: boolean
  children: ReactNode
}) {
  return (
    <span className={`${styles.cell} ${styles[tier]} ${strong ? styles.strong : ''}`}>
      <span className={styles.cellLabel}>{label}</span>
      <span className={styles.number}>{children}</span>
    </span>
  )
}

/** Valor usado pela ordenação de cada coluna. */
export function auditValueOf(row: AuditRow, key: AuditSortKey): string | number {
  switch (key) {
    case 'description':
      return row.description
    case 'stock':
      return row.stock
    case 'outflow':
      return row.outflow
    case 'costPrice':
      return row.costPrice
    case 'salePrice':
      return row.salePrice
    case 'totalCost':
      return rowCostTotal(row)
    case 'totalSale':
      return rowSaleTotal(row)
    case 'counted':
      return row.counted
    case 'difference':
      return rowDifference(row)
    case 'differenceValue':
      return rowDifferenceValue(row)
  }
}
