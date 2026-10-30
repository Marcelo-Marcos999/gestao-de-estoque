import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { CloseIcon } from './icons'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Ações do rodapé. Sem elas o rodapé não é desenhado. */
  footer?: ReactNode
  wide?: boolean
  /**
   * `false` ignora Esc e o clique no fundo; só o botão de fechar e o rodapé
   * fecham. Para o que não pode se perder sem querer, como uma senha mostrada
   * uma única vez.
   */
  dismissible?: boolean
  children: ReactNode
}

/**
 * Usa o <dialog> nativo: foco preso dentro, Esc para fechar e inertização do
 * resto da página vêm do navegador, sem reimplementar acessibilidade à mão.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  footer,
  wide,
  dismissible = true,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Todos os diálogos da tela existem no DOM ao mesmo tempo, apenas fechados.
  // Um id fixo se repetiria e deixaria o aria-labelledby ambíguo.
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // Esc dispara o evento 'cancel' do próprio elemento; sem tratar, o diálogo
  // fecharia sem o estado do React saber.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    const onCancel = (event: Event) => {
      event.preventDefault()
      if (dismissible) onClose()
    }

    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [onClose, dismissible])

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ''}`}
      aria-labelledby={titleId}
      onClick={(event) => {
        // Clique no backdrop: o alvo é o próprio <dialog>, não seu conteúdo.
        if (dismissible && event.target === ref.current) onClose()
      }}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.titles}>
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>

          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  )
}
