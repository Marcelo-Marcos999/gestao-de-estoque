import { Dialog } from '@/shared/ui/Dialog'
import { CameraIcon, ImageIcon } from '@/shared/ui/icons'
import styles from './AttachmentSourceDialog.module.css'

interface AttachmentSourceDialogProps {
  open: boolean
  /** Do que é o arquivo ("Foto do produto"), para a pessoa saber qual espaço tocou. */
  label: string
  onClose: () => void
  onCamera: () => void
  onFiles: () => void
}

/**
 * De onde vem o arquivo: a câmera agora, ou a galeria/os arquivos do aparelho. Duas
 * opções grandes, porque quem usa está no corredor com uma mão só.
 */
export function AttachmentSourceDialog({ open, label, onClose, onCamera, onFiles }: AttachmentSourceDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={label || 'Anexo'} subtitle="De onde vem o arquivo?">
      <div className={styles.options}>
        <button type="button" className={styles.option} onClick={onCamera}>
          <CameraIcon width={24} height={24} />
          <span className={styles.title}>Tirar foto agora</span>
          <span className={styles.hint}>Abre a câmera do aparelho</span>
        </button>
        <button type="button" className={styles.option} onClick={onFiles}>
          <ImageIcon width={24} height={24} />
          <span className={styles.title}>Galeria ou arquivos</span>
          <span className={styles.hint}>Escolher uma foto ou arquivo já salvo</span>
        </button>
      </div>
    </Dialog>
  )
}
