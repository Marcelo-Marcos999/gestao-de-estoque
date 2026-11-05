/**
 * Uma parcela da contagem: um registro de quem contou, quanto e quando. A
 * contagem de um produto é a soma delas; guardá-las separadas é o que permite
 * dizer, numa auditoria, de onde veio cada unidade.
 */
export interface AuditEntry {
  id: string
  quantity: number
  /** Nome do login que registrou (pode ser o administrador contando por outra loja). */
  by: string
  at: string
}

/**
 * Uma linha da auditoria: um produto contado numa loja, com os números do
 * ESTOQUE da mesma loja ao lado, para comparar.
 */
export interface AuditRow {
  productId: string
  storeId: string
  storeName: string
  sku: string
  description: string
  barcode: string
  /** A soma de todas as parcelas. */
  counted: number
  lastAt: string
  /** Falso quando a loja nunca lançou estoque deste produto: saldo e valores vêm zerados. */
  hasStock: boolean
  stock: number
  outflow: number
  costPrice: number
  salePrice: number
  entries: AuditEntry[]
}

export interface AuditQuery {
  search: string
  /** Só o que não confere: a pergunta de quem audita. */
  onlyDifferences: boolean
}

/** Identidade de uma linha: o mesmo produto aparece uma vez por loja. */
export function rowKey(row: Pick<AuditRow, 'productId' | 'storeId'>): string {
  return `${row.storeId}:${row.productId}`
}
