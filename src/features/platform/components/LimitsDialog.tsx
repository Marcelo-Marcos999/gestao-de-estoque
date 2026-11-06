import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { TextField } from '@/shared/ui/TextField'
import type { CompanyLimits, PlatformCompany } from '../types'
import styles from './LimitsDialog.module.css'

interface LimitsDialogProps {
  /** `null` fecha o diálogo. */
  company: PlatformCompany | null
  busy: boolean
  error: string | null
  onSave: (limits: CompanyLimits) => void
  onClose: () => void
}

const toText = (value: number | null) => (value === null ? '' : String(value))

/** Vazio = sem limite; senão, inteiro de 1 em diante. `undefined` = texto inválido. */
function parse(text: string): number | null | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return undefined
  const value = Number(trimmed)
  return value >= 1 ? value : undefined
}

/**
 * Edita os três limites de uma empresa. O limite de logins é o que o administrador
 * dela enfrenta ao criar logins (o servidor recusa o excedente); os outros dois o
 * banco aplica a cada registro e a cada arquivo.
 *
 * Reduzir abaixo do uso atual é permitido e não apaga nada: só impede de crescer.
 */
export function LimitsDialog({ company, busy, error, onSave, onClose }: LimitsDialogProps) {
  const [users, setUsers] = useState('')
  const [storage, setStorage] = useState('')
  const [records, setRecords] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)

  // Preenche com os valores da empresa a cada vez que o diálogo abre para ela.
  if ((company?.id ?? null) !== shown) {
    setShown(company?.id ?? null)
    setUsers(toText(company?.userLimit ?? null))
    setStorage(toText(company?.storageLimitMb ?? null))
    setRecords(toText(company?.recordLimit ?? null))
    setInvalid(false)
  }

  function handleSave() {
    const userLimit = parse(users)
    const storageLimitMb = parse(storage)
    const recordLimit = parse(records)
    if (userLimit === undefined || storageLimitMb === undefined || recordLimit === undefined) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onSave({ userLimit, storageLimitMb, recordLimit })
  }

  const field = (label: string, value: string, set: (v: string) => void, hint: string) => (
    <TextField
      label={label}
      value={value}
      onChange={(event) => {
        set(event.target.value)
        setInvalid(false)
      }}
      inputMode="numeric"
      placeholder="Sem limite"
      hint={hint}
      autoComplete="off"
    />
  )

  return (
    <Dialog
      open={company !== null}
      onClose={onClose}
      title="Limites da empresa"
      subtitle={company?.name}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={busy}>
            {busy ? 'Salvando…' : 'Salvar limites'}
          </Button>
        </>
      }
    >
      {company && (
        <div className={styles.body}>
          {error && <Alert tone="danger">{error}</Alert>}
          {invalid && <Alert tone="danger">Use números inteiros a partir de 1, ou deixe vazio para sem limite.</Alert>}
          {field('Logins ativos', users, setUsers, `Hoje: ${company.activeUsers.toLocaleString('pt-BR')} ativos.`)}
          {field('Registros', records, setRecords, `Hoje: ${company.recordsUsed.toLocaleString('pt-BR')}.`)}
          {field(
            'Arquivos (MB)',
            storage,
            setStorage,
            `Hoje: ${(company.filesUsedBytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB.`,
          )}
        </div>
      )}
    </Dialog>
  )
}
