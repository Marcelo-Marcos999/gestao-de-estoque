import { useState } from 'react'
import type { DragEvent } from 'react'
import { UploadIcon } from './icons'
import styles from './ImportFileStep.module.css'

interface ImportFileStepProps {
  busy: boolean
  onSelect: (file: File) => void
}

/**
 * Primeira etapa de qualquer assistente de importação: arrastar ou escolher o
 * arquivo. Não conhece produto, estoque nem nenhum outro domínio — por isso
 * mora em `shared/`, para as duas importações do sistema usarem a mesma peça
 * em vez de duas cópias idênticas (ver CLAUDE.md).
 */
export function ImportFileStep({ busy, onSelect }: ImportFileStepProps) {
  const [dragging, setDragging] = useState(false)

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)

    const file = event.dataTransfer.files[0]
    if (file) onSelect(file)
  }

  return (
    <label
      className={`${styles.dropzone} ${dragging ? styles.active : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <UploadIcon width={32} height={32} />
      <span className={styles.title}>
        {busy ? 'Lendo a planilha…' : 'Arraste a planilha aqui'}
      </span>
      <span className={styles.hint}>ou clique para escolher — aceita .xlsx e .csv</span>

      <input
        className={styles.input}
        type="file"
        accept=".xlsx,.csv,.txt,.tsv"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onSelect(file)
          // Permite escolher o mesmo arquivo de novo depois de um erro.
          event.target.value = ''
        }}
      />
    </label>
  )
}
