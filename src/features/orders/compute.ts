import { cellToNumber } from '@/shared/lib/cell'
import type { Discount, Order } from './types'

/**
 * Pré-visualização do total de uma linha, em CENTAVOS inteiros.
 *
 * É só o que o diálogo mostra enquanto se digita. O valor que vale é o que o
 * servidor grava e devolve (`OrderLine.total`); aqui o cálculo em centavos evita
 * 4,99 × 2 virar 9,979999… na tela.
 */
export function previewLine(quantity: number, unitPrice: number, discount: Discount) {
  const gross = Math.round(unitPrice * 100) * quantity
  const off =
    discount.type === 'percent'
      ? Math.round((gross * discount.value) / 100)
      : Math.round(discount.value * 100)
  return { gross: gross / 100, total: (gross - off) / 100 }
}

/**
 * Lê um número digitado do jeito brasileiro ("2,50"). Vazio vale 0 — "sem
 * desconto" —, e texto que não é número vale `null`, para a tela avisar em vez de
 * gravar um zero que a pessoa não digitou.
 */
export function parseTyped(text: string): number | null {
  if (text.trim() === '') return 0
  return cellToNumber(text)
}

/** Os números do rodapé do pedido. */
export function orderTotals(order: Pick<Order, 'lines' | 'total' | 'cost'>) {
  const subtotalCents = order.lines.reduce(
    (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
    0,
  )
  const subtotal = subtotalCents / 100
  const profit = Math.round((order.total - order.cost) * 100) / 100
  return {
    subtotal,
    discounts: Math.round((subtotal - order.total) * 100) / 100,
    profit,
    // Sobre o que o cliente paga, não sobre o custo: é a margem que se lê num PDV.
    marginPercent: order.total > 0 ? (profit / order.total) * 100 : 0,
  }
}

/** "−10%" ou "−R$ 2,50", para a etiqueta do desconto na linha. */
export function discountLabel(discount: Discount, formatMoney: (n: number) => string): string | null {
  if (discount.value <= 0) return null
  return discount.type === 'percent'
    ? `−${discount.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : `−${formatMoney(discount.value)}`
}
