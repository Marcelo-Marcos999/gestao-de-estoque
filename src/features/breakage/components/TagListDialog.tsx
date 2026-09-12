import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { TrashIcon } from '@/shared/ui/icons'
import type { TagUsage } from '../hooks/useTagLists'
import type { Tag } from '../types'
import styles from './TagListDialog.module.css'

interface TagListDialogProps {
  open: boolean
  /** "Motivo" ou "Origem", já no singular que a tela usa. */
  label: string
  tags: Tag[]
  usage: TagUsage
  onClose: () => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
}

/**
 * Corrige a lista da loja: renomeia e exclui etiquetas.
 *
 * Existe porque a lista é editável, e não só crescível — sem isso, um
 * "danificada" digitado errado ficaria para sempre ao lado de "Danificado", e
 * a soma por motivo deixaria de fechar, que é justamente o que a lista única
 * evita (ver docs/dominio.md).
 *
 * Fica num diálogo, e não no próprio formulário, porque corrigir a lista da
 * loja é outra tarefa: misturar as duas encheria de botões o passo em que a
 * pessoa só quer apontar uma perda.
 */
export function TagListDialog({
  open,
  label,
  tags,
  usage,
  onClose,
  onRename,
  onDelete,
}: TagListDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Editar ${label.toLowerCase()}s`}
      subtitle="A lista é uma só, da loja: corrigir aqui vale para todo mundo."
      footer={<Button onClick={onClose}>Concluir</Button>}
    >
      <div className={styles.body}>
        <Alert tone="info">
          Renomear conserta os registros que já usam a etiqueta — eles apontam
          para ela, não para o texto. Excluir só é possível enquanto ninguém a
          estiver usando.
        </Alert>

        <ul className={styles.list}>
          {tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              inUse={usage[tag.id] ?? 0}
              onRename={(texto) => onRename(tag.id, texto)}
              onDelete={() => onDelete(tag.id)}
            />
          ))}
        </ul>
      </div>
    </Dialog>
  )
}

interface TagRowProps {
  tag: Tag
  inUse: number
  onRename: (label: string) => void
  onDelete: () => void
}

function TagRow({ tag, inUse, onRename, onDelete }: TagRowProps) {
  const [draft, setDraft] = useState(tag.label)

  // Grava ao sair do campo, não a cada tecla: gravar por tecla faria a lista
  // inteira ser reescrita no storage a cada letra digitada.
  function commit() {
    const texto = draft.trim()
    if (!texto || texto === tag.label) {
      setDraft(tag.label)
      return
    }
    onRename(texto)
  }

  return (
    <li className={styles.row}>
      <input
        className={styles.input}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') setDraft(tag.label)
        }}
        aria-label={`Nome de ${tag.label}`}
      />

      {inUse > 0 ? (
        <span className={styles.inUse}>
          {inUse} {inUse === 1 ? 'registro' : 'registros'}
        </span>
      ) : (
        <button
          type="button"
          className={styles.delete}
          onClick={onDelete}
          aria-label={`Excluir ${tag.label}`}
          title={`Excluir ${tag.label}`}
        >
          <TrashIcon width={16} height={16} />
        </button>
      )}
    </li>
  )
}
