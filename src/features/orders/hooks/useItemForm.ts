import { useState } from 'react'
import type { ChosenProduct } from '@/features/products'
import { parseTyped, previewLine } from '../compute'
import type { DiscountType, Order, OrderLine } from '../types'
import { useProductPosition } from './useProductPosition'

const DEFAULT_QUANTITY = '1'

/**
 * Os campos do item (produto, quantidade, desconto) e tudo que se deduz deles: o
 * preço, se o formulário já pode ser gravado e a pré-visualização do total.
 *
 * Fica fora do diálogo porque a validade dos campos e as contas são a maior parte da
 * lógica do formulário, e o componente deve cuidar de desenhar.
 */
export function useItemForm(order: Order, line?: OrderLine) {
  const [product, setProduct] = useState<ChosenProduct | null>(null)
  // Texto: um campo numérico controlado não deixa apagar para digitar outro valor.
  const [quantity, setQuantity] = useState(line ? String(line.quantity) : DEFAULT_QUANTITY)
  const [discountType, setDiscountType] = useState<DiscountType>(line?.discount.type ?? 'percent')
  const [discountText, setDiscountText] = useState(
    line && line.discount.value > 0 ? String(line.discount.value).replace('.', ',') : '',
  )

  const productId = line ? line.productId : (product?.productId ?? null)
  const { position, failed } = useProductPosition(order.id, productId)

  // Em edição vale o preço GRAVADO no item (o do dia em que entrou); em item novo, o do estoque.
  const unitPrice = line ? line.unitPrice : (position?.salePrice ?? 0)
  const unitCost = line ? line.unitCost : (position?.costPrice ?? 0)

  const parsedQty = quantity.trim() === '' ? NaN : Number(quantity)
  const qtyOk = Number.isInteger(parsedQty) && parsedQty >= 1 && parsedQty <= 1_000_000
  // Inválida vale 0: quem usa confere `qtyOk` antes, e assim `qty` é sempre um número.
  const qty = qtyOk ? parsedQty : 0
  const typed = parseTyped(discountText)
  // O teto do desconto em reais é o valor do item: passar dele deixaria a linha negativa.
  const gross = qtyOk ? previewLine(qty, unitPrice, { type: 'amount', value: 0 }).gross : Infinity
  const discountOk =
    typed !== null && typed >= 0 && (discountType === 'percent' ? typed <= 100 : typed <= gross)
  const priced = unitPrice > 0

  const preview =
    qtyOk && discountOk && typed !== null
      ? previewLine(qty, unitPrice, { type: discountType, value: typed })
      : null
  const costOfLine = qtyOk ? (Math.round(unitCost * 100) * qty) / 100 : 0
  const margin = preview ? Math.round((preview.total - costOfLine) * 100) / 100 : null

  return {
    product,
    setProduct,
    productId,
    position,
    failed,
    quantity,
    setQuantity,
    discountType,
    setDiscountType,
    discountText,
    setDiscountText,
    unitPrice,
    unitCost,
    qty,
    qtyOk,
    typed,
    discountOk,
    priced,
    // Item novo só grava depois que a consulta ao estoque voltou: o servidor lê o preço de lá.
    ready: (line !== undefined || position !== null) && priced && qtyOk && discountOk,
    preview,
    costOfLine,
    margin,
    /** Depois de gravar um item novo: limpa os campos para o próximo produto. */
    reset: () => {
      setProduct(null)
      setQuantity(DEFAULT_QUANTITY)
      setDiscountText('')
    },
  }
}
