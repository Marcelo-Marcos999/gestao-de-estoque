import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { ArrowLeftIcon, CheckIcon } from '@/shared/ui/icons'
import {
  validateNewPassword,
  validateOnBlur,
  validatePasswordConfirmation,
} from '@/shared/lib/validation'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordRequirements } from '../components/PasswordRequirements'
import { resetPassword } from '../api'
import styles from '../components/authForm.module.css'

interface FieldErrors {
  password?: string
  confirmation?: string
}

/**
 * Criação de uma nova senha, alcançada pelo link enviado por e-mail.
 *
 * O token vem no endereço; quem chega aqui sem ele (ou com um expirado) recebe
 * o erro só ao enviar, porque é o servidor que sabe se o token vale.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // O aviso de um campo some assim que a pessoa volta a digitar nele.
  const edit =
    (field: keyof FieldErrors, set: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      set(event.target.value)
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors: FieldErrors = {
      password: validateNewPassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    }
    setFieldErrors(errors)
    if (errors.password || errors.confirmation) return

    setFormError(null)
    setSubmitting(true)

    const { error } = await resetPassword(token, password)

    setSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }

    setDone(true)
  }

  // Tela de confirmação. Substitui o formulário em vez de virar um aviso
  // acima dele: depois de trocar a senha não há mais nada a preencher aqui, e
  // deixar os campos na tela convidaria a tentar de novo.
  if (done) {
    return (
      <AuthLayout title="Senha alterada">
        <div className={styles.confirmation}>
          <span className={styles.confirmationIcon}>
            <CheckIcon width={26} height={26} />
          </span>

          <p className={styles.confirmationText}>
            Sua senha foi atualizada. Use a nova senha para entrar no sistema.
          </p>

          <Button onClick={() => navigate('/entrar', { replace: true })}>
            Ir para o login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Criar nova senha" subtitle="Escolha uma senha que você não usa em outro lugar.">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <TextField
          label="Nova senha"
          name="new-password"
          value={password}
          onChange={edit('password', setPassword)}
          error={fieldErrors.password}
          autoComplete="new-password"
          revealable
          autoFocus
          required
        />

        <PasswordRequirements password={password} />

        <TextField
          label="Repita a nova senha"
          name="confirm-password"
          value={confirmation}
          onChange={edit('confirmation', setConfirmation)}
          onBlur={() =>
            setFieldErrors((prev) => ({
              ...prev,
              confirmation: validateOnBlur(confirmation, (value) =>
                validatePasswordConfirmation(password, value),
              ),
            }))
          }
          error={fieldErrors.confirmation}
          autoComplete="new-password"
          revealable
          required
        />

        <Button type="submit" loading={submitting} fullWidth>
          {submitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>

      <div className={styles.center}>
        <Link className={styles.backLink} to="/entrar">
          <ArrowLeftIcon width={16} height={16} />
          Voltar para o login
        </Link>
      </div>
    </AuthLayout>
  )
}
