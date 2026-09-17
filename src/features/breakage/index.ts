/** Única porta de entrada da feature de quebra (ver CLAUDE.md). */
export { BreakagePage } from './pages/BreakagePage'
export { LossRecordDialog } from './components/LossRecordDialog'
export { countLossRecords, createLossRecordsByReasonLabel } from './api'
export type { LossRecord, LossRecordDraft, LossRecordInitialDraft } from './types'
