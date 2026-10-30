import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ArrowLeftIcon, CheckIcon } from '@/shared/ui/icons'
import { AuthLayout } from '../components/AuthLayout'
import { confirmEmail } from '../api'
import styles from '../components/authForm.module.css'

/**
 * Destino do link do e-mail de confirmação.
 *
 * Só confirma quando a pessoa CLICA no botão, não ao abrir a página. Alguns
 * antivírus e leitores de e-mail abrem os links por conta própria pra
 * inspecioná-los; se abrir a página bastasse, esse "clique" automático gastaria
 * o link (que é de uso único) antes de a pessoa chegar nele.
 */
export function ConfirmEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)

    const result = await confirmEmail(token)

    setSubmitting(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <AuthLayout title="E-mail confirmado">
        <div className={styles.confirmation}>
          <span className={styles.confirmationIcon}>
            <CheckIcon width={26} height={26} />
          </span>

          <p className={styles.confirmationText}>
            Sua conta está ativa. Entre com o e-mail e a senha que você criou.
          </p>

          <Button onClick={() => navigate('/entrar', { replace: true })}>Ir para o login</Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Confirmar e-mail" subtitle="Falta só um passo para ativar sua conta.">
      <div className={styles.confirmation}>
        {!token && (
          <Alert tone="danger">Este link está incompleto. Abra o link direto do e-mail.</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        <Button onClick={handleConfirm} loading={submitting} disabled={!token} fullWidth>
          {submitting ? 'Confirmando…' : 'Confirmar meu e-mail'}
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
