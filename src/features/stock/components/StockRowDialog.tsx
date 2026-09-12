import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import type { StockRow } from '../types'
import styles from './StockRowDialog.module.css'

/** O que o diálogo devolve ao salvar. */
export interface StockEdit {
  stock: number
  outflow: number
  costPrice: number
  salePrice: number
}

interface StockRowDialogProps {
  row: StockRow | null
  saving: boolean
  onClose: () => void
  onSave: (edit: StockEdit) => void
}

/**
 * Corrige os quatro números de um produto.
 *
 * Os dois perfis editam — não é a bancada do administrador, que é o cadastro
 * de SKU, descrição e código de barras (ver CLAUDE.md, "Perfis de acesso").
 * Normalmente estes números vêm da importação; aqui é o ajuste manual para
 * quando o relatório não bate com a prateleira.
 *
 * Montado só quando aberto, e com chave por produto: os campos nascem
 * preenchidos com a linha certa sem um efeito sincronizando prop com estado.
 */
export function StockRowDialog({ row, saving, onClose, onSave }: StockRowDialogProps) {
  if (!row) return null
  return <Form key={row.productId} row={row} saving={saving} onClose={onClose} onSave={onSave} />
}

function Form({ row, saving, onClose, onSave }: StockRowDialogProps & { row: StockRow }) {
  // Texto, e não número: um campo numérico controlado não deixa apagar o
  // conteúdo para digitar outro valor — o zero volta sozinho a cada tecla.
  const [stock, setStock] = useState(String(row.stock))
  const [outflow, setOutflow] = useState(String(row.outflow))
  const [costPrice, setCostPrice] = useState(String(row.costPrice))
  const [salePrice, setSalePrice] = useState(String(row.salePrice))

  function handleSave() {
    onSave({
      stock: Number(stock) || 0,
      outflow: Number(outflow) || 0,
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Editar estoque"
      subtitle={row.pendingCadastro ? `SKU ${row.sku} · pendente de cadastro` : row.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {row.pendingCadastro && (
          <Alert>
            Este produto ainda não tem descrição nem código de barras. Complete o cadastro no
            Cadastro de produtos — aqui você só ajusta os números.
          </Alert>
        )}

        <div className={styles.pair}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="stock-row-stock">
              Saldo em estoque
            </label>
            <input
              id="stock-row-stock"
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={0}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="stock-row-outflow">
              Saídas no período
            </label>
            <input
              id="stock-row-outflow"
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={0}
              value={outflow}
              onChange={(event) => setOutflow(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.pair}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="stock-row-cost">
              Valor de custo
            </label>
            <input
              id="stock-row-cost"
              className={styles.input}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={costPrice}
              onChange={(event) => setCostPrice(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="stock-row-sale">
              Valor de venda
            </label>
            <input
              id="stock-row-sale"
              className={styles.input}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={salePrice}
              onChange={(event) => setSalePrice(event.target.value)}
            />
          </div>
        </div>

        <dl className={styles.codes}>
          <div>
            <dt>SKU</dt>
            <dd className={styles.mono}>{row.sku}</dd>
          </div>
          <div>
            <dt>Código de barras</dt>
            <dd className={styles.mono}>{row.barcode || '—'}</dd>
          </div>
        </dl>
      </div>
    </Dialog>
  )
}
