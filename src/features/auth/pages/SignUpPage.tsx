import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { ArrowLeftIcon, MailIcon } from '@/shared/ui/icons'
import {
  validateEmail,
  validateNewPassword,
  validateOnBlur,
  validatePasswordConfirmation,
} from '@/shared/lib/validation'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordRequirements } from '../components/PasswordRequirements'
import { useAuth } from '../AuthContext'
import { resendConfirmation, signUp } from '../api'
import styles from '../components/authForm.module.css'

interface FieldErrors {
  companyName?: string
  email?: string
  password?: string
  confirmation?: string
}

function validateCompanyName(value: string): string | undefined {
  const name = value.trim()
  if (!name) return 'Informe o nome da empresa.'
  if (name.length < 2) return 'O nome é curto demais.'
  return undefined
}

/**
 * Criar conta. Quem cria vira administrador da própria empresa.
 *
 * A conta só funciona depois de confirmar o e-mail, e a tela de "enviamos um
 * link" é a mesma exista o e-mail ou não: dizer "e-mail já cadastrado" faria
 * deste formulário uma forma de descobrir quem já usa o sistema.
 */
export function SignUpPage() {
  const { user } = useAuth()

  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resendNote, setResendNote] = useState<string | null>(null)

  if (user) return <Navigate to="/validades" replace />

  // O aviso de um campo some assim que a pessoa volta a digitar nele: deixar
  // "Crie uma senha." embaixo de uma senha já digitada faz parecer que o
  // formulário não percebeu.
  const edit =
    (field: keyof FieldErrors, set: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      set(event.target.value)
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors: FieldErrors = {
      companyName: validateCompanyName(companyName),
      email: validateEmail(email),
      password: validateNewPassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    }
    setFieldErrors(errors)
    if (Object.values(errors).some(Boolean)) return

    setFormError(null)
    setSubmitting(true)

    const { error } = await signUp({ companyName: companyName.trim(), email: email.trim(), password })

    setSubmitting(false)

    // Nada digitado é apagado num erro: refazer um formulário de cadastro
    // inteiro por causa de uma falha do servidor é o que faz a pessoa desistir.
    if (error) {
      setFormError(error.message)
      return
    }

    setSentTo(email.trim())
  }

  async function handleResend() {
    if (!sentTo) return

    setResendNote(null)
    const { error } = await resendConfirmation(sentTo)
    setResendNote(error ? error.message : 'Enviamos um novo link. Confira sua caixa de entrada.')
  }

  if (sentTo) {
    return (
      <AuthLayout title="Confirme seu e-mail">
        <div className={styles.confirmation}>
          <span className={styles.confirmationIcon}>
            <MailIcon width={26} height={26} />
          </span>

          <p className={styles.confirmationText}>
            Enviamos um link de confirmação para <span className={styles.strong}>{sentTo}</span>.
            Clique nele para ativar sua conta. O link vale por 24 horas.
          </p>

          <p className={styles.confirmationText}>
            Não chegou? Confira a caixa de spam, ou peça um novo link.
          </p>

          {resendNote && <Alert>{resendNote}</Alert>}

          <Button variant="secondary" onClick={handleResend}>
            Reenviar e-mail
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
    <AuthLayout title="Criar conta" subtitle="Cadastre sua empresa e comece a controlar as validades.">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <TextField
          label="Nome da empresa"
          name="organization"
          value={companyName}
          onChange={edit('companyName', setCompanyName)}
          onBlur={() =>
            setFieldErrors((prev) => ({
              ...prev,
              companyName: validateOnBlur(companyName, validateCompanyName),
            }))
          }
          error={fieldErrors.companyName}
          autoComplete="organization"
          autoFocus
          required
        />

        <TextField
          label="E-mail"
          type="email"
          name="email"
          value={email}
          onChange={edit('email', setEmail)}
          onBlur={() =>
            setFieldErrors((prev) => ({ ...prev, email: validateOnBlur(email, validateEmail) }))
          }
          error={fieldErrors.email}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="voce@empresa.com.br"
          required
        />

        <TextField
          label="Senha"
          name="new-password"
          value={password}
          onChange={edit('password', setPassword)}
          error={fieldErrors.password}
          autoComplete="new-password"
          revealable
          required
        />

        <PasswordRequirements password={password} />

        <TextField
          label="Repita a senha"
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
          {submitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <div className={styles.center}>
        <Link className={styles.backLink} to="/entrar">
          <ArrowLeftIcon width={16} height={16} />
          Já tenho conta
        </Link>
      </div>
    </AuthLayout>
  )
}
