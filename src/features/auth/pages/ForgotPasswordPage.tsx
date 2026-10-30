import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { ArrowLeftIcon, MailIcon } from '@/shared/ui/icons'
import { validateEmail, validateOnBlur } from '@/shared/lib/validation'
import { AuthLayout } from '../components/AuthLayout'
import { requestPasswordReset } from '../api'
import styles from '../components/authForm.module.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const error = validateEmail(email)
    setFieldError(error)
    if (error) return

    setFormError(null)
    setSubmitting(true)
    const result = await requestPasswordReset(email.trim())
    setSubmitting(false)

    // Só chega erro que vale pra qualquer e-mail (envio desligado no servidor,
    // limite de tentativas, sem rede): avisar não revela se a conta existe.
    if (result.error) {
      setFormError(result.error.message)
      return
    }

    setSentTo(email.trim())
  }

  // A confirmação é sempre a mesma, exista ou não a conta: senão a tela vira
  // uma forma de descobrir quais e-mails estão cadastrados.
  if (sentTo) {
    return (
      <AuthLayout title="Confira seu e-mail">
        <div className={styles.confirmation}>
          <span className={styles.confirmationIcon}>
            <MailIcon width={26} height={26} />
          </span>

          <p className={styles.confirmationText}>
            Se houver uma conta para <span className={styles.strong}>{sentTo}</span>, enviamos
            um link para criar uma nova senha. O link vale por 1 hora.
          </p>

          <p className={styles.confirmationText}>
            Não chegou? Confira a caixa de spam ou tente novamente em alguns minutos.
          </p>

          <Button variant="secondary" onClick={() => setSentTo(null)}>
            Usar outro e-mail
          </Button>
        </div>

        <div className={styles.center}>
          <Link className={styles.backLink} to="/entrar">
            <ArrowLeftIcon width={16} height={16} />
            Voltar para o login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <TextField
          label="E-mail"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setFieldError(validateOnBlur(email, validateEmail))}
          error={fieldError}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="voce@empresa.com.br"
          autoFocus
          required
        />

        <Button type="submit" loading={submitting} fullWidth>
          {submitting ? 'Enviando…' : 'Enviar link de recuperação'}
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
