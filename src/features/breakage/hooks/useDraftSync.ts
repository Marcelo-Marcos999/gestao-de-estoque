import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { putAttachmentFile } from '../attachments'
import { deleteDraftFile, restoreDraftFiles, saveDraftFile, writeDraft, type LossDraft } from '../draft'
import type { Attachment, AttachmentKind } from '../types'

type Fields = Omit<LossDraft, 'open' | 'savedAt'>

/**
 * Mantém o rascunho do registro de quebra em dia (ver `draft.ts`): devolve ao
 * formulário os arquivos guardados e regrava o rascunho a cada mudança dos campos.
 *
 * Os arquivos voltam do IndexedDB depois da abertura. Até lá o rascunho não é
 * regravado: gravar com a lista de anexos ainda vazia apagaria o que falta restaurar.
 */
export function useDraftSync(
  enabled: boolean,
  stored: LossDraft | null,
  setAttachments: Dispatch<SetStateAction<Attachment[]>>,
  fields: Fields,
) {
  const [filesRestored, setFilesRestored] = useState(!stored || stored.attachments.length === 0)

  useEffect(() => {
    if (!stored || stored.attachments.length === 0) return

    let cancelled = false
    void restoreDraftFiles(stored.attachments).then((kept) => {
      if (cancelled) return
      // O que a pessoa já anexou de novo, enquanto isto carregava, vale mais que o rascunho.
      setAttachments((current) => [...kept.filter((k) => !current.some((c) => c.kind === k.kind)), ...current])
      setFilesRestored(true)
    })
    return () => {
      cancelled = true
    }
  }, [stored, setAttachments])

  const { product, expiryDate, quantity, reasonId, originId, note, attachments } = fields
  useEffect(() => {
    if (!enabled || !filesRestored) return
    writeDraft({ product, expiryDate, quantity, reasonId, originId, note, attachments })
  }, [enabled, filesRestored, product, expiryDate, quantity, reasonId, originId, note, attachments])
}

/**
 * Escolher e remover os arquivos do formulário.
 *
 * Um espaço por tipo: escolher de novo troca o que estava lá, em vez de empilhar duas
 * fotos do produto que ninguém saberia distinguir depois. Num registro novo o arquivo
 * é guardado também fora da memória (ver `draft.ts`): se a página for recarregada, a
 * foto não se perde.
 */
export function useFormFiles(
  usesDraft: boolean,
  attachments: Attachment[],
  setAttachments: Dispatch<SetStateAction<Attachment[]>>,
) {
  const attachFile = useCallback(
    (kind: AttachmentKind, file: File) => {
      const id = `${kind}-${Date.now()}`
      putAttachmentFile(id, file)
      if (usesDraft) saveDraftFile(id, file)

      setAttachments((current) => [
        ...current.filter((a) => a.kind !== kind),
        { id, kind, fileName: file.name, mimeType: file.type, size: file.size },
      ])
    },
    [usesDraft, setAttachments],
  )

  const removeAttachment = useCallback(
    (kind: AttachmentKind) => {
      if (usesDraft) attachments.filter((a) => a.kind === kind).forEach((a) => deleteDraftFile(a.id))
      setAttachments((current) => current.filter((a) => a.kind !== kind))
    },
    [usesDraft, attachments, setAttachments],
  )

  return { attachFile, removeAttachment }
}
