import { useState } from 'react'
import { BarcodeScanner } from './BarcodeScanner'
import { BarcodeIcon } from './icons'
import { useBarcodeSupport } from '../hooks/useBarcodeSupport'
import { prepareBeep } from '../lib/beep'
import styles from './ScanButton.module.css'

interface ScanButtonProps {
  /** Recebe o código lido. Cabe a quem chama decidir o que fazer com ele. */
  onDetect: (code: string) => void
  /** Texto do botão para leitor de tela; muda conforme o que a busca procura. */
  label?: string
}

/**
 * Ler o código de barras pela câmera, no lugar de digitá-lo.
 *
 * **Não existe onde o aparelho não lê.** É o caminho principal no corredor da
 * loja e um botão inútil no computador da sala — e oferecer uma ação que falha
 * no clique é pior que não oferecer (ver CLAUDE.md).
 */
export function ScanButton({ onDetect, label = 'Ler código de barras' }: ScanButtonProps) {
  const formats = useBarcodeSupport()
  const [open, setOpen] = useState(false)

  if (formats.length === 0) return null

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          // Dentro do toque, para o navegador liberar o som que vai tocar na leitura.
          prepareBeep()
          setOpen(true)
        }}
        aria-label={label}
        title={label}
      >
        <BarcodeIcon width={20} height={20} />
      </button>

      <BarcodeScanner
        open={open}
        formats={formats}
        onClose={() => setOpen(false)}
        onDetect={(code) => {
          setOpen(false)
          onDetect(code)
        }}
      />
    </>
  )
}
