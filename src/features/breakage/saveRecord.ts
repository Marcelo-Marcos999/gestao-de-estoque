import { createLossRecord, deleteLossRecords, updateLossRecord } from './api'
import { syncAttachments } from './attachments'
import type { Attachment, LossRecord, LossRecordDraft } from './types'

/**
 * Na EDIÇÃO, o registro já foi alterado mas algum anexo não subiu. O formulário
 * fica aberto, com o que o servidor já tem (`after`), para tentar de novo.
 */
export class AttachmentsFailedError extends Error {
  readonly after: Attachment[]
  readonly failed: Attachment[]

  constructor(after: Attachment[], failed: Attachment[]) {
    super(
      `O registro foi salvo, mas ${
        failed.length === 1 ? `o anexo "${failed[0].fileName}"` : 'alguns anexos'
      } não subiu. Toque em Salvar para tentar de novo.`,
    )
    this.after = after
    this.failed = failed
  }
}

/**
 * Grava o registro e os anexos dele. O arquivo só pode subir depois do registro
 * (o anexo pertence a ele), então são dois passos; esta função faz o par parecer
 * um só para quem salva.
 *
 * Registro NOVO cujo anexo não sobe é desfeito: deixá-lo salvo pela metade faria
 * quem tenta de novo criar um segundo registro igual. Registro EDITADO não tem
 * como voltar atrás, então avisa com `AttachmentsFailedError` e mantém o formulário.
 */
export async function saveLossRecord(
  draft: LossRecordDraft,
  editing: LossRecord | undefined,
  saved: Attachment[],
): Promise<void> {
  const id = editing ? editing.id : await createLossRecord(draft)
  if (editing) await updateLossRecord(editing.id, draft)

  const { attachments, failed } = await syncAttachments(id, draft.attachments, saved)
  if (failed.length === 0) return

  if (editing) throw new AttachmentsFailedError(attachments, failed)

  await deleteLossRecords([id]).catch(() => {})
  throw new Error(
    `Não foi possível enviar ${
      failed.length === 1 ? `o anexo "${failed[0].fileName}"` : 'os anexos'
    }. O registro não foi salvo; verifique a conexão e tente de novo.`,
  )
}
