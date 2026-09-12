import { useState } from 'react'
import { AlertIcon, EditIcon, PlusIcon } from '@/shared/ui/icons'
import { Button } from '@/shared/ui/Button'
import { tagIdFrom } from '../tags'
import type { TagUsage } from '../hooks/useTagLists'
import type { Tag } from '../types'
import { TagListDialog } from './TagListDialog'
import styles from './TagPicker.module.css'

interface TagPickerProps {
  label: string
  tags: Tag[]
  value: string
  optional?: boolean
  error?: string
  /** Quantos registros usam cada etiqueta — o que pode ou não ser excluído. */
  usage: TagUsage
  onChange: (id: string) => void
  /** Cria a etiqueta na lista da loja, não só neste registro. */
  onCreate: (tag: Tag) => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
}

/**
 * Escolha de motivo ou origem, com a opção de criar uma etiqueta nova sem sair
 * do formulário.
 *
 * Sair para uma tela de cadastro no meio de um registro faria a pessoa perder
 * o que já preencheu — e, na prática, faria ela escolher a etiqueta errada só
 * para não perder o caminho.
 */
export function TagPicker({
  label,
  tags,
  value,
  optional,
  error,
  usage,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: TagPickerProps) {
  const [creating, setCreating] = useState(false)
  const [novo, setNovo] = useState('')
  const [managing, setManaging] = useState(false)

  function confirmar() {
    const texto = novo.trim()
    if (!texto) {
      setCreating(false)
      return
    }

    // Etiqueta repetida é o que fragmenta o relatório: se já existe com esse
    // nome, seleciona a existente em vez de criar uma segunda.
    const existente = tags.find((t) => t.label.toLowerCase() === texto.toLowerCase())
    if (existente) {
      onChange(existente.id)
    } else {
      const tag: Tag = { id: tagIdFrom(texto, tags), label: texto, builtIn: false }
      onCreate(tag)
      onChange(tag.id)
    }

    setNovo('')
    setCreating(false)
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label}
        {optional && <span className={styles.optional}> (opcional)</span>}

        {/* Corrigir a lista é a saída para o "danificada" digitado errado, que
            de outro modo ficaria para sempre ao lado de "Danificado". */}
        <button
          type="button"
          className={styles.manage}
          onClick={() => setManaging(true)}
        >
          <EditIcon width={14} height={14} />
          Editar lista
        </button>
      </span>

      <div className={styles.options}>
        {tags.map((tag) => (
          <button
            type="button"
            key={tag.id}
            className={`${styles.option} ${value === tag.id ? styles.selected : ''}`}
            aria-pressed={value === tag.id}
            // Clicar na etiqueta já escolhida desmarca — o jeito de limpar um
            // campo opcional sem um botão só para isso.
            onClick={() => onChange(value === tag.id && optional ? '' : tag.id)}
          >
            {tag.label}
          </button>
        ))}

        {!creating && (
          <button
            type="button"
            className={`${styles.option} ${styles.add}`}
            onClick={() => setCreating(true)}
          >
            <PlusIcon width={16} height={16} />
            Novo
          </button>
        )}
      </div>

      {creating && (
        <div className={styles.newRow}>
          <input
            className={styles.newInput}
            value={novo}
            onChange={(event) => setNovo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                confirmar()
              }
              if (event.key === 'Escape') setCreating(false)
            }}
            placeholder={`Nome do ${label.toLowerCase()}`}
            aria-label={`Novo ${label.toLowerCase()}`}
            autoFocus
          />
          <Button onClick={confirmar}>Adicionar</Button>
        </div>
      )}

      {error && (
        <p className={styles.error}>
          <AlertIcon width={16} height={16} />
          {error}
        </p>
      )}

      <TagListDialog
        open={managing}
        label={label}
        tags={tags}
        usage={usage}
        onClose={() => setManaging(false)}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  )
}
