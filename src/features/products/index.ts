/** Única porta de entrada da feature de produtos (ver CLAUDE.md). */
export { ProductsPage } from './pages/ProductsPage'
export type { Product, ProductDraft } from './types'
export { getAllProducts, getProduct, listProducts, updateProductStock } from './api'
export { ProductsSkeleton } from './components/ProductsSkeleton'
