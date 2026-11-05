/**
 * Rascunho do registro de quebra.
 *
 * Quem registra uma quebra está no corredor, com o celular na mão, e entre o produto
 * e o "Salvar" ainda precisa abrir a câmera. Ao voltar dela o Android pode ter
 * descartado a página (falta de memória), ou o gesto de "voltar" pode ter fechado o
 * diálogo — e o registro inteiro se perdia, obrigando a recomeçar. O rascunho grava o
 * que já foi preenchido (e as fotos, no IndexedDB), e o registro volta como estava.
 *
 * Só vale para registro NOVO digitado à mão: editar um registro existente ou gerar a
 * quebra de um lote vencido já partem de dados que existem no servidor.
 */
import type { ChosenProduct } from '@/features/products'
import type { IsoDate } from '@/shared/lib/date'
import { deleteBlob, loadBlob, saveBlob } from '@/shared/lib/blobStore'
import { readJson, removeKey, storageKey, writeJson } from '@/shared/lib/storage'
import { putAttachmentFile } from './attachments'
import type { Attachment } from './types'

const KEY = storageKey('rascunho', 'quebra')

/** Um rascunho esquecido por dias voltaria como um registro que ninguém reconhece. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface LossDraft {
  /** O diálogo estava aberto quando foi gravado (some ao fechar sem cancelar). */
  open: boolean
  savedAt: number
  product: ChosenProduct | null
  expiryDate: IsoDate | null
  quantity: number
  reasonId: string
  originId: string
  note: string
  /** Só a descrição dos anexos; os arquivos moram no IndexedDB, pelo `id`. */
  attachments: Attachment[]
}

function isDraft(value: unknown): value is LossDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Partial<LossDraft>
  return (
    typeof draft.open === 'boolean' &&
    typeof draft.savedAt === 'number' &&
    typeof draft.quantity === 'number' &&
    typeof draft.reasonId === 'string' &&
    typeof draft.originId === 'string' &&
    typeof draft.note === 'string' &&
    Array.isArray(draft.attachments)
  )
}

/** O rascunho guardado, ou `null` se não há, está corrompido ou ficou velho demais. */
export function readDraft(): LossDraft | null {
  const stored = readJson<unknown>(KEY, null)
  if (!isDraft(stored)) return null
  if (Date.now() - stored.savedAt > MAX_AGE_MS) {
    clearDraft()
    return null
  }
  return stored
}

/** Havia um registro em andamento com o diálogo aberto (a página foi recarregada no meio)? */
export function hasOpenDraft(): boolean {
  return readDraft()?.open === true
}

/** Nada digitado nem anexado: não vale guardar. */
export function isEmptyDraft(draft: Omit<LossDraft, 'open' | 'savedAt'>): boolean {
  return (
    draft.product === null &&
    draft.expiryDate === null &&
    draft.reasonId === '' &&
    draft.originId === '' &&
    draft.note.trim() === '' &&
    draft.attachments.length === 0
  )
}

export function writeDraft(draft: Omit<LossDraft, 'open' | 'savedAt'>): void {
  if (isEmptyDraft(draft)) {
    clearDraft()
    return
  }
  writeJson(KEY, { ...draft, open: true, savedAt: Date.now() })
}

/** O diálogo fechou sem cancelar: o rascunho fica, mas não reabre sozinho. */
export function markDraftClosed(): void {
  const draft = readDraft()
  if (draft) writeJson(KEY, { ...draft, open: false })
}

/** Cancelou ou salvou: apaga o rascunho e as fotos dele. */
export function clearDraft(): void {
  const draft = readJson<unknown>(KEY, null)
  if (isDraft(draft)) draft.attachments.forEach((a) => void deleteBlob(a.id))
  removeKey(KEY)
}

/** Guarda a foto escolhida junto do rascunho. */
export function saveDraftFile(id: string, file: File): void {
  void saveBlob(id, file)
}

export function deleteDraftFile(id: string): void {
  void deleteBlob(id)
}

/**
 * Devolve à memória os arquivos do rascunho (onde `uploadAttachment` os procura) e
 * diz quais anexos ainda existem: um arquivo que o navegador já apagou some do
 * registro em vez de aparecer como anexo que não abre.
 */
export async function restoreDraftFiles(attachments: Attachment[]): Promise<Attachment[]> {
  const kept: Attachment[] = []
  for (const attachment of attachments) {
    const blob = await loadBlob(attachment.id)
    if (!blob) continue
    putAttachmentFile(attachment.id, new File([blob], attachment.fileName, { type: attachment.mimeType }))
    kept.push(attachment)
  }
  return kept
}
