import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '@/shared/lib/http'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Logo } from '@/shared/ui/Logo'
import { TextField } from '@/shared/ui/TextField'
import { signInPlatform } from '../api'
import styles from './PlatformLogin.module.css'

interface PlatformLoginProps {
  onSignedIn: (token: string, name: string) => void
}

/**
 * Entrada do painel da plataforma. É um login à parte do dos clientes (outra tabela,
 * outro token), e por isso não há "criar conta" nem "esqueci a senha": o acesso é criado
 * por quem tem o banco, pelo script do back-end.
 */
export function PlatformLogin({ onSignedIn }: PlatformLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Informe o e-mail e a senha.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const { token, name } = await signInPlatform(email.trim(), password)
      onSignedIn(token, name)
    } catch (erro) {
      setError(
        erro instanceof ApiError
          ? erro.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
            : erro.message
          : 'Não foi possível conectar ao servidor. Tente de novo.',
      )
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Logo size={40} />
        </div>
        <h1 className={styles.title}>Plataforma</h1>
        <p className={styles.subtitle}>Acesso restrito à administração do sistema.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextField
            label="E-mail"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
          <TextField
            label="Senha"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            revealable
          />
          <Button type="submit" loading={submitting} fullWidth>
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </main>
  )
}
