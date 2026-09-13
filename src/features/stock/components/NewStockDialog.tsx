import { useEffect, useRef, useState } from 'react'
import { useProductSearch } from '@/features/products'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { ScanButton } from '@/shared/ui/ScanButton'
import { addStockRow } from '../api'
import styles from './NewStockDialog.module.css'

interface NewStockDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Põe os números de um produto à mão, sem planilha.
 *
 * É o mesmo caminho da importação com uma linha só — inclusive a regra do SKU
 * desconhecido, que entra como pendente de cadastro em vez de ser recusado
 * (ver docs/dominio.md). Reusar o caminho importa: fosse um segundo, as duas
 * portas poderiam divergir sobre o que fazer com um SKU que ninguém conhece.
 */
export function NewStockDialog({ open, onClose, onSaved }: NewStockDialogProps) {
  if (!open) return null
  return <Form onClose={onClose} onSaved={onSaved} />
}

function Form({ onClose, onSaved }: Omit<NewStockDialogProps, 'open'>) {
  const [sku, setSku] = useState('')
  // Texto, e não número: um campo numérico controlado não deixa apagar o
  // conteúdo para digitar outro valor.
  const [stock, setStock] = useState('0')
  const [outflow, setOutflow] = useState('0')
  const [costPrice, setCostPrice] = useState('0')
  const [salePrice, setSalePrice] = useState('0')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Mesma busca do seletor de produtos, com a espera entre teclas que evita
  // varrer 26 mil registros a cada letra.
  const { busca, results } = useProductSearch(sku)

  // Só o casamento exato de SKU vale: a busca também acha por descrição e por
  // código de barras, e um "quase" aqui gravaria no produto errado.
  const produto = results?.find((p) => p.sku === busca) ?? null
  const respondeu = results !== null && busca !== ''
  const conhecido = respondeu && produto !== null
  const desconhecido = respondeu && produto === null

  /**
   * Casou com um produto que já existe: os campos passam a mostrar os números
   * atuais dele.
   *
   * Sem isto o formulário é uma armadilha — o botão diz "Atualizar produto",
   * os campos estão em zero, e salvar zeraria saldo, saídas, custo e venda de
   * um produto que tinha valores. Quem quer mudar só o saldo não deveria
   * precisar redigitar os outros três para não perdê-los.
   *
   * Carrega uma vez por produto casado, não a cada resposta da busca: recarregar
   * apagaria o que a pessoa já digitou enquanto a busca ia e voltava.
   */
  const carregado = useRef<string | null>(null)
  useEffect(() => {
    if (!produto || carregado.current === produto.id) return

    carregado.current = produto.id
    setStock(String(produto.stock))
    setOutflow(String(produto.outflow))
    setCostPrice(String(produto.costPrice))
    setSalePrice(String(produto.salePrice))
  }, [produto])

  async function salvar() {
    const codigo = sku.trim()
    if (!codigo) {
      setErro('Informe o código SKU: é por ele que a linha casa com o cadastro.')
      return
    }

    setSaving(true)
    await addStockRow({
      sku: codigo,
      stock: Number(stock) || 0,
      outflow: Number(outflow) || 0,
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
    })
    setSaving(false)

    onSaved()
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Adicionar ao estoque"
      subtitle="Os mesmos números da planilha, digitados à mão."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} loading={saving}>
            {conhecido ? 'Atualizar produto' : 'Adicionar'}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-stock-sku">
            Código SKU
          </label>
          <div className={styles.skuRow}>
            <input
              id="new-stock-sku"
              className={styles.input}
              value={sku}
              onChange={(event) => {
                setSku(event.target.value)
                setErro(null)
              }}
              placeholder="Como está no cadastro"
              autoComplete="off"
              autoFocus
            />
            {/* No corredor a etiqueta está na mão e o teclado do celular não. */}
            <ScanButton onDetect={setSku} label="Ler o código do produto" />
          </div>

          {/* Dizer antes de salvar o que vai acontecer: atualizar um produto que
              já existe e criar um pendente são resultados bem diferentes. */}
          {conhecido && produto && (
            <span className={styles.found}>
              {produto.description} — os números deste produto serão atualizados.
            </span>
          )}
          {desconhecido && (
            <span className={styles.pending}>
              SKU fora do cadastro: entra como pendente, e o administrador
              completa descrição e código de barras depois.
            </span>
          )}
        </div>

        <div className={styles.pair}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-stock-stock">
              Saldo em estoque
            </label>
            <input
              id="new-stock-stock"
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={0}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-stock-outflow">
              Saídas no período
            </label>
            <input
              id="new-stock-outflow"
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
            <label className={styles.label} htmlFor="new-stock-cost">
              Valor de custo
            </label>
            <input
              id="new-stock-cost"
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
            <label className={styles.label} htmlFor="new-stock-sale">
              Valor de venda
            </label>
            <input
              id="new-stock-sale"
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

        {erro && <Alert tone="danger">{erro}</Alert>}
      </div>
    </Dialog>
  )
}
