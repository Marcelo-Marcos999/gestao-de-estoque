import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { DownloadIcon, EyeIcon, FileIcon } from '@/shared/ui/icons'
import { downloadBlob } from '@/shared/lib/download'
import {
  ATTACHMENT_LABELS,
  attachmentUrl,
  fetchAttachmentBlob,
  formatSize,
  isImage,
} from '../attachments'
import type { Attachment } from '../types'
import styles from './AttachmentViewer.module.css'

interface AttachmentViewerProps {
  attachment: Attachment | null
  onClose: () => void
}

/** O que já se sabe do arquivo aberto; `id` impede de mostrar o de um anexo anterior. */
interface Source {
  id: string
  url?: string
}

/**
 * Vê o anexo e o baixa.
 *
 * Imagem aparece na hora — é o caso comum, a foto da etiqueta que alguém quer
 * conferir sem sair da lista. Documento não tenta se mostrar: um PDF embutido
 * num diálogo pequeno é pior que o leitor do próprio sistema, então aqui ele
 * se apresenta e oferece duas saídas: abrir em outra aba, para ler, ou baixar.
 *
 * O arquivo vem do servidor com o token de quem está logado, então há um
 * instante de carregamento (e a chance de falhar, sem rede, por exemplo).
 */
export function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  const [source, setSource] = useState<Source | null>(null)

  useEffect(() => {
    if (!attachment) return

    let cancelled = false
    attachmentUrl(attachment)
      .then((url) => !cancelled && setSource({ id: attachment.id, url }))
      .catch(() => !cancelled && setSource({ id: attachment.id }))

    return () => {
      cancelled = true
    }
  }, [attachment])

  if (!attachment) return null

  const current = source?.id === attachment.id ? source : null
  const url = current?.url
  const failed = current !== null && !url
  const imagem = isImage(attachment)

  /**
   * Abre o documento numa nova aba, no leitor do próprio navegador, sem salvar o
   * arquivo. Não é uma pré-visualização dentro do diálogo: o celular não mostra PDF
   * embutido numa página, e é nele que o sistema é usado.
   */
  function abrir() {
    if (url) window.open(url, '_blank', 'noopener')
  }

  async function baixar() {
    if (!attachment) return
    downloadBlob(await fetchAttachmentBlob(attachment), attachment.fileName)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={ATTACHMENT_LABELS[attachment.kind]}
      subtitle={`${attachment.fileName} · ${formatSize(attachment.size)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          {!imagem && (
            <Button variant="secondary" onClick={abrir} disabled={!url}>
              <EyeIcon width={18} height={18} />
              <span>Abrir</span>
            </Button>
          )}
          <Button onClick={() => void baixar()} disabled={!url}>
            <DownloadIcon width={18} height={18} />
            <span>Baixar</span>
          </Button>
        </>
      }
    >
      {url && imagem && (
        <img className={styles.image} src={url} alt={ATTACHMENT_LABELS[attachment.kind]} />
      )}

      {url && !imagem && (
        <div className={styles.file}>
          <FileIcon className={styles.fileIcon} width={40} height={40} />
          <span className={styles.fileName}>{attachment.fileName}</span>
          <span className={styles.fileHint}>Abra para ler agora, em outra aba, ou baixe para guardar no aparelho.</span>
        </div>
      )}

      {!current && (
        <div className={styles.file} role="status">
          <FileIcon className={styles.fileIcon} width={40} height={40} />
          <span className={styles.fileName}>Carregando…</span>
        </div>
      )}

      {failed && (
        <div className={styles.file}>
          <FileIcon className={styles.fileIcon} width={40} height={40} />
          <span className={styles.fileName}>Arquivo indisponível</span>
          <span className={styles.fileHint}>
            Não foi possível carregar o arquivo. Verifique a conexão e abra de novo.
          </span>
        </div>
      )}
    </Dialog>
  )
}
