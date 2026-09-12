import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { EditIcon } from '@/shared/ui/icons'
import styles from './PeriodField.module.css'

interface PeriodFieldProps {
  days: number
  onChange: (days: number) => void
}

/**
 * O período do relatório de saídas, editável onde ele aparece.
 *
 * Fica aqui, e não numa tela de configurações, porque é aqui que a conta que
 * ele sustenta está à vista: quem lê "sai em 195 dias" é quem percebe que o
 * intervalo está errado, e mandá-lo a outra tela para corrigir faria o número
 * continuar errado.
 *
 * Ele desloca **todas** as situações de uma vez, então a edição é explícita —
 * um clique para abrir, confirmar para gravar — em vez de um campo sempre
 * aberto, onde um toque sem querer no corredor mudaria a tela inteira.
 */
export function PeriodField({ days, onChange }: PeriodFieldProps) {
  const [editing, setEditing] = useState(false)
  // Texto, e não número: um campo numérico controlado não deixa apagar o
  // conteúdo para digitar outro valor — o valor antigo volta a cada tecla.
  const [draft, setDraft] = useState(String(days))

  function abrir() {
    setDraft(String(days))
    setEditing(true)
  }

  function confirmar() {
    const valor = Number(draft)
    // Valor impossível não vira erro na cara do usuário: mantém o que havia,
    // que é o comportamento que ele já esperava do campo.
    if (Number.isFinite(valor) && valor >= 1) onChange(valor)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button type="button" className={styles.display} onClick={abrir}>
        Período das saídas:
        <span className={styles.value}>{days} dias</span>
        <EditIcon className={styles.icon} width={14} height={14} />
      </button>
    )
  }

  return (
    <div className={styles.editor}>
      <label className={styles.label} htmlFor="expiry-period">
        Período das saídas
      </label>
      <input
        id="expiry-period"
        className={styles.input}
        type="number"
        inputMode="numeric"
        min={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            confirmar()
          }
          if (event.key === 'Escape') setEditing(false)
        }}
        autoFocus
      />
      <Button onClick={confirmar}>Salvar</Button>
    </div>
  )
}
