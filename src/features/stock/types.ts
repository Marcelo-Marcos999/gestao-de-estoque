/**
 * Uma linha da tela de Estoque: o produto, visto pelos números que vêm da
 * importação dos relatórios.
 *
 * Não é uma entidade própria — é o mesmo `Product` do cadastro, só que
 * observado pelos campos que esta tela edita (saldo, saídas, custo e venda)
 * em vez dos campos de identidade (SKU, descrição, código de barras), que são
 * do administrador (ver CLAUDE.md, "Perfis de acesso").
 */
export interface StockRow {
  productId: string
  sku: string
  description: string
  barcode: string
  stock: number
  outflow: number
  costPrice: number
  salePrice: number
  /** Ainda sem descrição nem código de barras: a importação criou o produto. */
  pendingCadastro: boolean
}

export interface StockQuery {
  search: string
  /** Restringe a produtos pendentes de cadastro. */
  onlyPending: boolean
}
