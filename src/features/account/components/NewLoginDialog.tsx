import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { validateEmail } from '@/shared/lib/validation'
import type { LoginWithPassword, NewLoginDraft } from '../types'

interface NewLoginDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (draft: NewLoginDraft) => Promise<{ data: LoginWithPassword | null; error: string | null }>
  /** Chamado com o login criado, para a tela mostrar a senha provisória. */
  onCreated: (created: LoginWithPassword) => void
}

/**
 * Cria um login (uma loja). A senha não é digitada aqui: o sistema sorteia uma
 * provisória e a entrega uma vez — escolher a senha de outra pessoa é pedir
 * por "123456".
 *
 * Quem usa troca a `key` a cada abertura, então o que foi digitado da vez
 * anterior não volta sozinho.
 */
export function NewLoginDialog({ open, onClose, onCreate, onCreated }: NewLoginDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<NewLoginDraft['role']>('operador')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const found = {
      name: name.trim().length < 2 ? 'Informe o nome da loja.' : undefined,
      email: validateEmail(email),
    }
    setErrors(found)
    if (found.name || found.email) return

    setFormError(null)
    setSaving(true)
    const { data, error } = await onCreate({ name: name.trim(), email: email.trim(), role })
    setSaving(false)

    if (error || !data) {
      setFormError(error ?? 'Não foi possível criar o login.')
      return
    }
    onCreated(data)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo login"
      subtitle="Cada login é uma loja. Você entrega a senha provisória à pessoa."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="new-login-form" loading={saving}>
            {saving ? 'Criando…' : 'Criar login'}
          </Button>
        </>
      }
    >
      <form id="new-login-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <TextField
          label="Nome da loja"
          name="store-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setErrors((prev) => ({ ...prev, name: undefined }))
          }}
          error={errors.name}
          placeholder="Ex.: Loja Centro"
          autoFocus
          required
        />

        <TextField
          label="E-mail de acesso"
          type="email"
          name="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          error={errors.email}
          autoComplete="off"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />

        <Select
          label="Perfil"
          value={role}
          onChange={(event) => setRole(event.target.value as NewLoginDraft['role'])}
          options={[
            { value: 'operador', label: 'Operador — registra quebras e consulta produtos' },
            { value: 'admin', label: 'Administrador — também cuida do cadastro e dos logins' },
          ]}
          hint="O perfil não muda depois. Para trocar, desative este login e crie outro."
        />
      </form>
    </Dialog>
  )
}
