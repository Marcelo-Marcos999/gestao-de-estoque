/** Única porta de entrada da feature de produtos (ver CLAUDE.md). */
export { ProductsPage } from './pages/ProductsPage'
export type { Product, ProductDraft } from './types'
export {
  bulkUpsertStock,
  getAllProducts,
  getProduct,
  listProducts,
  updateProductStock,
  type StockImportResult,
  type StockImportRow,
  type StockValues,
} from './api'
export { ProductsSkeleton } from './components/ProductsSkeleton'
export { useProductSearch } from './hooks/useProductSearch'
export { ProductPicker } from './components/ProductPicker'
export type { ChosenProduct } from './components/ProductPicker'
