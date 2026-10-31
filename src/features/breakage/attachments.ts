/**
 * Os arquivos anexados aos registros de quebra.
 *
 * Moram no bucket da Cloudflare (R2), pelo back-end (`/anexos`). O registro só
 * guarda os dados do arquivo (nome, tipo, tamanho); o conteúdo é baixado sob
 * demanda, com o token de quem está logado.
 *
 * Um arquivo escolhido no formulário ainda não existe no servidor: fica na
 * memória até o registro ser salvo — o registro precisa existir para receber o
 * anexo — e só então sobe (`syncAttachments`).
 */
import { apiFetch, apiFetchBlob, apiFetchPublico } from '@/shared/lib/http'
import { reduceImage } from '@/shared/lib/image'
import type { Attachment, AttachmentKind } from './types'

/** Escolhidos no formulário e ainda não enviados, pelo id provisório. */
const pending = new Map<string, File>()

export function putAttachmentFile(id: string, file: File): void {
  pending.set(id, file)
}

export function isPendingAttachment(id: string): boolean {
  return pending.has(id)
}

/** O anexo como o servidor o descreve. */
export interface AnexoApi {
  id: string
  tipo: AttachmentKind
  nome: string
  mime: string
  tamanho: number
}

export function paraAnexo(a: AnexoApi): Attachment {
  return { id: a.id, kind: a.tipo, fileName: a.nome, mimeType: a.mime, size: a.tamanho }
}

/** O formato que o servidor espera para devolver os anexos de um registro (o "desfazer"). */
export function paraAnexoApi(a: Attachment): AnexoApi {
  return { id: a.id, tipo: a.kind, nome: a.fileName, mime: a.mimeType, tamanho: a.size }
}

/**
 * Endereços já criados, para não baixar de novo a cada abertura do visualizador.
 * O conteúdo de um id nunca muda (trocar o arquivo cria outro id), então o cache
 * não envelhece.
 */
const urls = new Map<string, Promise<string>>()

/** O arquivo, seja o que ainda vai subir ou o que está no servidor. */
export async function fetchAttachmentBlob(attachment: Attachment): Promise<Blob> {
  return pending.get(attachment.id) ?? (await apiFetchBlob(`/anexos/${attachment.id}`))
}

/** Endereço para mostrar o arquivo na tela. */
export function attachmentUrl(attachment: Attachment): Promise<string> {
  const existente = urls.get(attachment.id)
  if (existente) return existente

  const url = fetchAttachmentBlob(attachment).then((blob) => URL.createObjectURL(blob))
  urls.set(attachment.id, url)
  // Falhou (rede, 404): a próxima abertura tenta de novo em vez de lembrar do erro.
  url.catch(() => urls.delete(attachment.id))
  return url
}

/** Manda um arquivo escolhido para o registro; uma foto é reduzida antes. */
async function uploadAttachment(recordId: string, attachment: Attachment): Promise<Attachment> {
  const original = pending.get(attachment.id)
  if (!original) throw new Error('O arquivo escolhido não está mais disponível.')

  const file = await reduceImage(original)
  const nome = encodeURIComponent(file.name)
  const enviado = paraAnexo(
    await apiFetch<AnexoApi>(`/anexos?quebra=${recordId}&tipo=${attachment.kind}&nome=${nome}`, {
      method: 'POST',
      file,
    }),
  )

  // Com o arquivo já em mãos, ver o anexo logo depois de salvar não baixa nada.
  urls.set(enviado.id, Promise.resolve(URL.createObjectURL(file)))
  pending.delete(attachment.id)
  return enviado
}

export interface AttachmentSync {
  /** Os anexos do registro depois da sincronização (os que falharam seguem como escolhidos). */
  attachments: Attachment[]
  failed: Attachment[]
}

/**
 * Leva ao servidor o que a pessoa mudou nos anexos de um registro: envia os
 * escolhidos e apaga os que ela removeu.
 *
 * Envia primeiro e apaga depois: trocar a foto não pode deixar o registro sem
 * nenhuma se o envio da nova falhar. Um espaço por tipo — o servidor já troca o
 * anterior ao receber o novo, então apagar o antigo depois pode dar "não
 * encontrado", e isso é sucesso.
 */
export async function syncAttachments(
  recordId: string,
  wanted: Attachment[],
  saved: Attachment[],
): Promise<AttachmentSync> {
  const attachments: Attachment[] = []
  const failed: Attachment[] = []

  for (const attachment of wanted) {
    if (!isPendingAttachment(attachment.id)) {
      attachments.push(attachment)
      continue
    }
    try {
      attachments.push(await uploadAttachment(recordId, attachment))
    } catch {
      attachments.push(attachment)
      failed.push(attachment)
    }
  }

  const stale = saved.filter((s) => !attachments.some((a) => a.id === s.id))
  for (const old of stale) {
    await apiFetch(`/anexos/${old.id}`, { method: 'DELETE' }).catch(() => {})
    urls.delete(old.id)
  }

  return { attachments, failed }
}

let enabled: Promise<boolean> | null = null

/** O servidor tem onde guardar os arquivos? Sem isso a tela esconde os anexos em vez de aceitar um que se perderia. */
export function attachmentsEnabled(): Promise<boolean> {
  enabled ??= apiFetchPublico<{ anexosAtivos?: boolean }>('/auth/recursos')
    .then((r) => r.anexosAtivos === true)
    .catch(() => {
      enabled = null
      return false
    })
  return enabled
}

export const ATTACHMENT_LABELS: Record<AttachmentKind, string> = {
  'foto-produto': 'Foto do produto',
  'foto-etiqueta': 'Foto da etiqueta',
  documento: 'Documento',
}

/** O que cada espaço aceita: foto abre a câmera, documento aceita PDF também. */
export const ATTACHMENT_ACCEPT: Record<AttachmentKind, string> = {
  'foto-produto': 'image/*',
  'foto-etiqueta': 'image/*',
  documento: 'application/pdf,image/*',
}

export function isImage(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith('image/')
}

/** "2,3 MB" — o número cru em bytes não diz nada a quem vai baixar. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
