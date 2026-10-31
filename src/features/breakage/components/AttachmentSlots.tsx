import type { ChangeEvent } from 'react'
import { CameraIcon, CloseIcon, FileIcon, ImageIcon } from '@/shared/ui/icons'
import { ATTACHMENT_ACCEPT, ATTACHMENT_LABELS, formatSize } from '../attachments'
import { useAttachmentsEnabled } from '../hooks/useAttachmentsEnabled'
import type { Attachment, AttachmentKind } from '../types'
import styles from './AttachmentSlots.module.css'

interface AttachmentSlotsProps {
  attachments: Attachment[]
  onAttach: (kind: AttachmentKind, file: File) => void
  onRemove: (kind: AttachmentKind) => void
  onOpen: (attachment: Attachment) => void
}

const SLOTS: Array<{ kind: AttachmentKind; Icon: typeof CameraIcon }> = [
  { kind: 'foto-produto', Icon: CameraIcon },
  { kind: 'foto-etiqueta', Icon: ImageIcon },
  { kind: 'documento', Icon: FileIcon },
]

/**
 * Anexos do registro.
 *
 * **Nenhum é obrigatório**, nem no motivo mais grave. Registro incompleto é
 * melhor que registro que não acontece porque o celular ficou sem bateria no
 * corredor — e o que falta pode ser anexado depois (ver docs/dominio.md).
 *
 * Cada espaço é um <label> com um input de arquivo escondido: no celular isso
 * abre direto a câmera ou a galeria, sem que a gente precise decidir por quem
 * está usando.
 */
export function AttachmentSlots({
  attachments,
  onAttach,
  onRemove,
  onOpen,
}: AttachmentSlotsProps) {
  const enabled = useAttachmentsEnabled()

  function handleChange(kind: AttachmentKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onAttach(kind, file)

    // Zera o input: sem isso, escolher o mesmo arquivo de novo depois de
    // remover não dispararia evento nenhum.
    event.target.value = ''
  }

  // Sem armazenamento no servidor não se oferece o anexo (ver `useAttachmentsEnabled`).
  if (enabled === false && attachments.length === 0) {
    return (
      <div className={styles.field}>
        <span className={styles.label}>Anexos</span>
        <p className={styles.hint} role="note">
          Os anexos ainda não estão ativos neste servidor. O registro é salvo normalmente, sem arquivos.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        Anexos <span className={styles.hint}>(ajudam a comprovar)</span>
      </span>

      <div className={styles.slots}>
        {SLOTS.map(({ kind, Icon }) => {
          const anexo = attachments.find((a) => a.kind === kind)
          const rotulo = ATTACHMENT_LABELS[kind]

          if (anexo) {
            return (
              <div className={`${styles.slot} ${styles.filled}`} key={kind}>
                <button
                  type="button"
                  className={styles.open}
                  onClick={() => onOpen(anexo)}
                  aria-label={`Ver ${rotulo}: ${anexo.fileName}`}
                >
                  <Icon className={styles.filledIcon} width={22} height={22} />
                  <span className={styles.fileName}>{anexo.fileName}</span>
                  <span className={styles.size}>{formatSize(anexo.size)}</span>
                </button>

                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => onRemove(kind)}
                  aria-label={`Remover ${rotulo}`}
                  title={`Remover ${rotulo}`}
                >
                  <CloseIcon width={14} height={14} />
                </button>
              </div>
            )
          }

          return (
            <label className={styles.slot} key={kind}>
              <input
                type="file"
                className={styles.input}
                accept={ATTACHMENT_ACCEPT[kind]}
                onChange={(event) => handleChange(kind, event)}
              />
              <Icon width={22} height={22} />
              <span className={styles.fileName}>{rotulo}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
