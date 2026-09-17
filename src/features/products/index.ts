/** Única porta de entrada da feature de produtos (ver CLAUDE.md). */
export { ProductsPage } from './pages/ProductsPage'
export type { Product, ProductDraft } from './types'
export {
  getAllProducts,
  getProduct,
  listProducts,
  updateProductStock,
  type StockValues,
} from './api'
export {
  bulkUpsertStock,
  type StockImportResult,
  type StockImportRow,
} from './stockImport'
export { ProductsSkeleton } from './components/ProductsSkeleton'
export { useProductSearch } from './hooks/useProductSearch'
export { ProductPicker } from './components/ProductPicker'
export type { ChosenProduct } from './components/ProductPicker'
