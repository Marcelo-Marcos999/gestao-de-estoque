import { useState } from 'react'
import { useAuth } from '@/features/auth'
import { Alert } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { PlusIcon } from '@/shared/ui/icons'
import { useLogins } from '../hooks/useLogins'
import type { LoginWithPassword, StoreLogin } from '../types'
import { LoginActionDialog, type LoginAction } from './LoginActionDialog'
import { NewLoginDialog } from './NewLoginDialog'
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog'
import panel from './panel.module.css'
import styles from './LoginsPanel.module.css'

/**
 * Lojas e logins da empresa: criar, desativar e redefinir senha.
 *
 * Só o administrador chega aqui (a aba nem aparece para o operador) e o
 * servidor recusa quem não for. Existe porque, sem e-mail, ninguém recupera a
 * própria senha: quem cuida disso é o administrador.
 */
export function LoginsPanel() {
  const { user } = useAuth()
  const { logins, company, status, reload, create, toggleActive, resetPassword } = useLogins()

  // `newKey` muda a cada abertura: remonta o diálogo e esvazia o formulário.
  const [newKey, setNewKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [action, setAction] = useState<LoginAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null)

  if (status === 'loading') return <p className={panel.text}>Carregando…</p>
  if (status === 'error' || !company) {
    return (
      <section className={panel.panel}>
        <Alert tone="danger">Não foi possível carregar os logins.</Alert>
        <div className={panel.actions}>
          <Button variant="secondary" onClick={() => void reload()}>
            Tentar de novo
          </Button>
        </div>
      </section>
    )
  }

  const full = company.userLimit !== null && company.activeUsers >= company.userLimit

  function openAction(kind: LoginAction['kind'], login: StoreLogin) {
    setActionError(null)
    setAction({ kind, login })
  }

  async function confirmAction() {
    if (!action) return

    setBusy(true)
    setActionError(null)

    if (action.kind === 'reset') {
      const { password, error } = await resetPassword(action.login)
      if (error || !password) setActionError(error ?? 'Não foi possível gerar a senha.')
      else {
        setRevealed({ email: action.login.email, password })
        setAction(null)
      }
    } else {
      const error = await toggleActive(action.login)
      if (error) setActionError(error)
      else setAction(null)
    }

    setBusy(false)
  }

  function handleCreated(created: LoginWithPassword) {
    setCreating(false)
    setRevealed({ email: created.login.email, password: created.temporaryPassword })
  }

  return (
    <section className={`${panel.panel} ${panel.wide}`} aria-labelledby="logins-title">
      <div className={styles.header}>
        <div className={styles.titles}>
          <h2 className={panel.title} id="logins-title">
            Lojas e logins
          </h2>
          <p className={panel.text}>
            {company.activeUsers.toLocaleString('pt-BR')}
            {company.userLimit !== null && ` de ${company.userLimit.toLocaleString('pt-BR')}`}{' '}
            {company.activeUsers === 1 ? 'login ativo' : 'logins ativos'}
          </p>
        </div>

        <Button
          onClick={() => {
            setNewKey((n) => n + 1)
            setCreating(true)
          }}
          disabled={full}
        >
          <PlusIcon width={18} height={18} />
          Novo login
        </Button>
      </div>

      {full && (
        <Alert tone="info">
          A conta chegou ao limite de logins do plano. Desative um login ou fale com o suporte para
          ampliar.
        </Alert>
      )}

      <ul className={styles.list}>
        {logins.map((login) => {
          const isMe = login.id === user?.id

          return (
            <li key={login.id} className={`${styles.item} ${login.active ? '' : styles.inactive}`}>
              <div className={styles.identity}>
                <span className={styles.name}>{login.name}</span>
                <span className={styles.email}>{login.email}</span>
              </div>

              <div className={styles.badges}>
                <Badge tone={login.role === 'admin' ? 'marca' : 'neutro'}>
                  {login.role === 'admin' ? 'Administrador' : 'Operador'}
                </Badge>
                {!login.active && <Badge tone="invalido">Inativo</Badge>}
                {isMe && <Badge tone="existente">Você</Badge>}
              </div>

              {/* O próprio login não tem ações aqui: a senha dele se troca em
                  "Minha conta" (pede a atual) e se desativar deixaria a conta
                  sem ninguém que a administre. */}
              {!isMe && (
                <div className={styles.rowActions}>
                  {login.active && (
                    <Button variant="secondary" onClick={() => openAction('reset', login)}>
                      Nova senha
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => openAction(login.active ? 'deactivate' : 'activate', login)}
                  >
                    {login.active ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <NewLoginDialog
        key={newKey}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={create}
        onCreated={handleCreated}
      />

      <LoginActionDialog
        action={action}
        busy={busy}
        error={actionError}
        onConfirm={() => void confirmAction()}
        onClose={() => setAction(null)}
      />

      <TemporaryPasswordDialog
        open={revealed !== null}
        email={revealed?.email ?? ''}
        password={revealed?.password ?? ''}
        onClose={() => setRevealed(null)}
      />
    </section>
  )
}
