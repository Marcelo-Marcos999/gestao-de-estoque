import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import type { StoreLogin } from '../types'

export type LoginActionKind = 'deactivate' | 'activate' | 'reset'

export interface LoginAction {
  kind: LoginActionKind
  login: StoreLogin
}

interface LoginActionDialogProps {
  /** `null` fecha o diálogo. */
  action: LoginAction | null
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

const COPY: Record<LoginActionKind, { title: string; confirm: string; danger: boolean; text: (name: string) => string }> = {
  deactivate: {
    title: 'Desativar login?',
    confirm: 'Desativar',
    danger: true,
    text: (name) =>
      `${name} perde o acesso agora; quem estiver com o sistema aberto é desconectado em até 15 minutos. Os registros dele continuam. Você pode reativar depois.`,
  },
  activate: {
    title: 'Reativar login?',
    confirm: 'Reativar',
    danger: false,
    text: (name) => `${name} volta a poder entrar com a senha que já tinha.`,
  },
  reset: {
    title: 'Gerar nova senha?',
    confirm: 'Gerar nova senha',
    danger: true,
    text: (name) =>
      `A senha atual de ${name} deixa de valer e ele é desconectado. Você recebe uma senha provisória para entregar.`,
  },
}

/**
 * Confirmação das ações que tiram o acesso de alguém ou trocam a senha dele.
 * Diferente da exclusão de registros (que tem desfazer e por isso não pergunta),
 * aqui não há como voltar atrás sozinho: a senha antiga não volta.
 */
export function LoginActionDialog({ action, busy, error, onConfirm, onClose }: LoginActionDialogProps) {
  const copy = action ? COPY[action.kind] : null

  return (
    <Dialog
      open={action !== null}
      onClose={onClose}
      title={copy?.title ?? ''}
      subtitle={action?.login.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant={copy?.danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {copy?.confirm ?? ''}
          </Button>
        </>
      }
    >
      {action && copy && (
        <>
          {error && <Alert tone="danger">{error}</Alert>}
          <p>{copy.text(action.login.name)}</p>
        </>
      )}
    </Dialog>
  )
}
