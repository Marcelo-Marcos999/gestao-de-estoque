/** Única porta de entrada da feature de validades (ver CLAUDE.md). */
export { ExpiryPage } from './pages/ExpiryPage'
export { SITUATIONS, SITUATION_ORDER, classify, daysToZero } from './situation'
export type { Situation } from './situation'
export { ensureExpiryItem } from './api'
