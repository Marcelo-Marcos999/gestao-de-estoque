import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { CameraIcon, CloseIcon, FileIcon, ImageIcon } from '@/shared/ui/icons'
import { ATTACHMENT_ACCEPT, ATTACHMENT_LABELS, formatSize } from '../attachments'
import { useAttachmentsEnabled } from '../hooks/useAttachmentsEnabled'
import type { Attachment, AttachmentKind } from '../types'
import { AttachmentSourceDialog } from './AttachmentSourceDialog'
import styles from './AttachmentSlots.module.css'

interface AttachmentSlotsProps {
  attachments: Attachment[]
  onAttach: (kind: AttachmentKind, file: File) => void
  onRemove: (kind: AttachmentKind) => void
  onOpen: (attachment: Attachment) => void
  /** O seletor de arquivos vai abrir: o formulário se protege de fechar sem querer na volta. */
  onPickerOpen?: () => void
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
 * No celular, tocar num espaço vazio pergunta de onde vem o arquivo: **câmera** ou
 * **galeria/arquivos**. Um único `<input accept="image/*">` não serve: o Android novo
 * abre só o seletor de fotos, sem a câmera. A câmera é um input próprio, com
 * `capture`. No computador não há câmera a escolher e o toque abre os arquivos.
 */
export function AttachmentSlots({
  attachments,
  onAttach,
  onRemove,
  onOpen,
  onPickerOpen,
}: AttachmentSlotsProps) {
  const enabled = useAttachmentsEnabled()
  // Só o toque tem câmera para escolher; o computador vai direto aos arquivos.
  const touch = useMediaQuery('(pointer: coarse)')
  const [choosing, setChoosing] = useState<AttachmentKind | null>(null)
  // Os inputs ficam sempre montados: se morassem dentro do diálogo de escolha, ele
  // fecharia (e os desmontaria) antes de o seletor devolver o arquivo.
  const cameraRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const targetKind = useRef<AttachmentKind>('foto-produto')

  function pick(kind: AttachmentKind, source: 'camera' | 'files') {
    targetKind.current = kind
    const input = source === 'camera' ? cameraRef.current : filesRef.current
    if (!input) return
    // O que o seletor de arquivos aceita depende do espaço (documento aceita PDF).
    if (source === 'files') input.accept = ATTACHMENT_ACCEPT[kind]
    onPickerOpen?.()
    // Precisa ser dentro do toque do usuário, senão o navegador bloqueia o seletor.
    input.click()
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onAttach(targetKind.current, file)

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
            <button
              type="button"
              className={styles.slot}
              key={kind}
              onClick={() => (touch ? setChoosing(kind) : pick(kind, 'files'))}
            >
              <Icon width={22} height={22} />
              <span className={styles.fileName}>{rotulo}</span>
            </button>
          )
        })}
      </div>

      <input
        ref={cameraRef}
        type="file"
        className={styles.hiddenInput}
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
      <input
        ref={filesRef}
        type="file"
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />

      <AttachmentSourceDialog
        label={choosing ? ATTACHMENT_LABELS[choosing] : ''}
        open={choosing !== null}
        onClose={() => setChoosing(null)}
        onCamera={() => {
          if (choosing) pick(choosing, 'camera')
          setChoosing(null)
        }}
        onFiles={() => {
          if (choosing) pick(choosing, 'files')
          setChoosing(null)
        }}
      />
    </div>
  )
}
