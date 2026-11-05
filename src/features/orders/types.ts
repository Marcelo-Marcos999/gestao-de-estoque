/**
 * Pedido (PD) de cliente: o vendedor monta os itens, aplica desconto e fecha com o
 * total que o cliente vai pagar. Fechado, só muda se for reaberto.
 */
export type OrderStatus = 'open' | 'closed'

/** 'percent': % sobre o item. 'amount': reais abatidos do item inteiro (quantidade × preço). */
export type DiscountType = 'percent' | 'amount'

export interface Discount {
  type: DiscountType
  /** 0 é "sem desconto". */
  value: number
}

export interface OrderLine {
  id: string
  /** Nulo quando o produto foi apagado do cadastro depois da venda: a linha continua. */
  productId: string | null
  sku: string
  description: string
  barcode: string
  quantity: number
  /** Preço e custo do dia em que o item entrou: mudar o estoque depois não mexe no pedido. */
  unitPrice: number
  unitCost: number
  discount: Discount
  /** Quanto o cliente paga por esta linha, já com o desconto (calculado pelo servidor). */
  total: number
  /** O que a linha custou à loja, sem desconto. */
  cost: number
}

export interface OrderSummary {
  id: string
  storeId: string
  storeName: string
  number: number
  customer: string
  note: string
  status: OrderStatus
  /** Nome do login que montou o pedido. */
  by: string
  createdAt: string
  closedAt: string | null
  itemCount: number
  unitCount: number
  total: number
  cost: number
}

export interface Order extends OrderSummary {
  lines: OrderLine[]
}

/** O que a loja do pedido tem do produto escolhido: base para vender e dar desconto. */
export interface ProductPosition {
  hasStock: boolean
  stock: number
  salePrice: number
  costPrice: number
  /** Quantas unidades deste produto o pedido já tem (em outras linhas). */
  alreadyInOrder: number
}

export type StatusFilter = 'all' | OrderStatus

export interface OrderQuery {
  search: string
  status: StatusFilter
}
