import { useState } from 'react'
import type { FormEvent } from 'react'
import { ProductPicker } from '@/features/products'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { addLine, updateLine } from '../api'
import { useItemForm } from '../hooks/useItemForm'
import { useShowCost } from '../hooks/useShowCost'
import type { Order, OrderLine } from '../types'
import { CostToggle } from './CostToggle'
import { DiscountField } from './DiscountField'
import { messageOf } from './itemMessages'
import { ItemFacts, ItemPreview } from './ItemSummary'
import styles from './OrderItemDialog.module.css'

interface OrderItemDialogProps {
  open: boolean
  onClose: () => void
  order: Order
  /** Presente: edita esta linha (quantidade e desconto). Ausente: adiciona produtos. */
  line?: OrderLine
  /** O pedido já recalculado pelo servidor depois de gravar. */
  onSaved: (order: Order) => void
}

/** Adicionar e editar o item do pedido: produto, quantidade, desconto e (se quiser) o custo. */
export function OrderItemDialog({ open, ...rest }: OrderItemDialogProps) {
  if (!open) return null
  return <Form {...rest} />
}

function Form({ onClose, order, line, onSaved }: Omit<OrderItemDialogProps, 'open'>) {
  const [showCost, setShowCost] = useShowCost()
  const f = useItemForm(order, line)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // Remonta o seletor depois de cada item gravado, devolvendo o foco à busca.
  const [round, setRound] = useState(0)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!f.productId) return setError('Escolha o produto.')
    if (!f.priced) return setError('Este produto não tem preço de venda no estoque desta loja.')
    if (!f.qtyOk) return setError('Informe a quantidade: 1 ou mais, sem casas decimais.')
    if (!f.discountOk || f.typed === null) {
      return setError(
        f.discountType === 'percent'
          ? 'O desconto é de 0 a 100%.'
          : 'O desconto em reais não pode passar do valor do item.',
      )
    }

    setSaving(true)
    setError(null)
    try {
      const discount = { type: f.discountType, value: f.typed }
      const saved = line
        ? await updateLine(order.id, line.id, f.qty, discount)
        : await addLine(order.id, f.productId, f.qty, discount)
      onSaved(saved)
      if (line) return onClose()

      setDone(`${f.product?.description || `SKU ${f.product?.sku}`} adicionado: ${saved.itemCount} ${saved.itemCount === 1 ? 'item' : 'itens'} no pedido.`)
      f.reset()
      setRound((current) => current + 1)
    } catch (erro) {
      setError(messageOf(erro))
    } finally {
      setSaving(false)
    }
  }

  const name = line ? line.description : f.product?.description

  return (
    <Dialog
      open
      onClose={onClose}
      title={line ? 'Editar item' : 'Adicionar item'}
      subtitle={`PD ${order.number} · ${order.customer}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {line ? 'Cancelar' : 'Concluir'}
          </Button>
          <Button type="submit" form="order-item-form" loading={saving} disabled={!f.ready && !saving}>
            {line ? 'Salvar item' : 'Gravar item'}
          </Button>
        </>
      }
    >
      <form className={styles.form} id="order-item-form" onSubmit={(e) => void save(e)} noValidate>
        {done && <Alert tone="success">{done}</Alert>}

        {line ? (
          <div className={styles.fixed}>
            <span className={styles.fixedName}>{line.description}</span>
            <span className={styles.codes}>
              SKU {line.sku}
              {line.barcode && ` · ${line.barcode}`}
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Produto</span>
            {/* Sem pendente: o pedido vende o que o estoque da loja tem, com preço. */}
            <ProductPicker
              key={round}
              chosen={f.product}
              allowPending={false}
              onChoose={(chosen) => {
                f.setProduct(chosen)
                setError(null)
                setDone(null)
              }}
              onDescriptionChange={() => {}}
            />
          </div>
        )}

        {name && (
          <ItemFacts
            price={f.priced ? f.unitPrice : null}
            stock={f.position ? f.position.stock : null}
            cost={showCost ? f.unitCost : null}
          />
        )}

        {f.failed && <Alert tone="danger">Não foi possível consultar o estoque deste produto. Tente de novo.</Alert>}
        {name && f.position && !f.priced && !line && (
          <Alert tone="danger">
            Este produto não tem preço de venda no estoque desta loja. Lance o preço na tela de
            Estoque antes de vendê-lo.
          </Alert>
        )}

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="order-quantity">
              Quantidade
            </label>
            <input
              id="order-quantity"
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={f.quantity}
              // Seleciona o "1" ao entrar: quem quer 10 digita 10, em vez de 110.
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                f.setQuantity(event.target.value)
                setError(null)
              }}
            />
          </div>

          <DiscountField
            type={f.discountType}
            text={f.discountText}
            onType={f.setDiscountType}
            onText={(text) => {
              f.setDiscountText(text)
              setError(null)
            }}
          />
        </div>

        {f.qtyOk && f.position && f.position.hasStock && f.qty > f.position.stock && (
          <Alert tone="info">
            Há {f.position.stock.toLocaleString('pt-BR')} em estoque nesta loja e o pedido pede{' '}
            {f.qty.toLocaleString('pt-BR')}. Você pode gravar mesmo assim.
          </Alert>
        )}
        {!line && f.position && f.position.alreadyInOrder > 0 && (
          <Alert tone="info">
            Este produto já está no pedido ({f.position.alreadyInOrder.toLocaleString('pt-BR')} un). Gravar
            cria outra linha.
          </Alert>
        )}

        {f.preview && (
          <ItemPreview
            total={f.preview.total}
            gross={f.preview.gross}
            cost={showCost ? f.costOfLine : null}
            margin={f.margin}
          />
        )}

        <div>
          <CostToggle shown={showCost} onChange={setShowCost} />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Dialog>
  )
}
