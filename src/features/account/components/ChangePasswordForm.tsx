import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { PasswordRequirements } from '@/features/auth'
import { ApiError } from '@/shared/lib/http'
import {
  validateNewPassword,
  validateOnBlur,
  validatePasswordConfirmation,
  validateRequiredPassword,
} from '@/shared/lib/validation'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { changePassword } from '../api'
import styles from './panel.module.css'

interface FieldErrors {
  current?: string
  next?: string
  confirmation?: string
}

/**
 * Troca da própria senha. Pede a atual de novo mesmo com a sessão aberta: sem
 * isso, quem pegasse um celular desbloqueado trocaria a senha e tomaria a
 * conta (o servidor também exige, esta é só a ponta da tela).
 */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // O aviso de um campo some assim que a pessoa volta a digitar nele.
  const edit =
    (field: keyof FieldErrors, set: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      set(event.target.value)
      setErrors((prev) => ({ ...prev, [field]: undefined }))
      setDone(false)
    }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const found: FieldErrors = {
      current: validateRequiredPassword(current),
      next:
        validateNewPassword(next) ??
        (next === current ? 'A nova senha precisa ser diferente da atual.' : undefined),
      confirmation: validatePasswordConfirmation(next, confirmation),
    }
    setErrors(found)
    if (Object.values(found).some(Boolean)) return

    setFormError(null)
    setDone(false)
    setSubmitting(true)

    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirmation('')
      setDone(true)
    } catch (erro) {
      // 403 é "a senha atual está errada": aparece no campo certo, não no topo.
      if (erro instanceof ApiError && erro.status === 403) setErrors({ current: erro.message })
      else setFormError(erro instanceof ApiError ? erro.message : 'Não foi possível trocar a senha. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="change-password-title">
      <h2 className={styles.title} id="change-password-title">
        Trocar senha
      </h2>
      <p className={styles.text}>
        Ao trocar, os outros aparelhos em que você está conectado são desconectados.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        {done && <Alert tone="success">Senha alterada.</Alert>}

        <TextField
          label="Senha atual"
          name="current-password"
          value={current}
          onChange={edit('current', setCurrent)}
          error={errors.current}
          autoComplete="current-password"
          revealable
          required
        />

        <TextField
          label="Nova senha"
          name="new-password"
          value={next}
          onChange={edit('next', setNext)}
          error={errors.next}
          autoComplete="new-password"
          revealable
          required
        />

        <PasswordRequirements password={next} />

        <TextField
          label="Repita a nova senha"
          name="confirm-password"
          value={confirmation}
          onChange={edit('confirmation', setConfirmation)}
          onBlur={() =>
            setErrors((prev) => ({
              ...prev,
              confirmation: validateOnBlur(confirmation, (value) =>
                validatePasswordConfirmation(next, value),
              ),
            }))
          }
          error={errors.confirmation}
          autoComplete="new-password"
          revealable
          required
        />

        <div className={styles.actions}>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Salvando…' : 'Trocar senha'}
          </Button>
        </div>
      </form>
    </section>
  )
}
