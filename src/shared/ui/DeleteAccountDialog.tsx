import { useState } from 'react'
import { Alert } from './Alert'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { TextField } from './TextField'
import styles from './DeleteAccountDialog.module.css'

interface DeleteAccountDialogProps {
  open: boolean
  companyName: string
  /** O cliente reconfirma a senha; o dono da plataforma já está autenticado, só digita o nome. */
  askPassword: boolean
  busy: boolean
  error: string | null
  onConfirm: (values: { confirmation: string; password: string }) => void
  onClose: () => void
}

/** Mesma regra do servidor: espaços das pontas e repetidos não contam, maiúsculas e acentos sim. */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * Confirmação da exclusão de uma empresa inteira. É a única ação do sistema sem
 * volta, e por isso a mais cerimoniosa: o botão só liga quando a pessoa digita o
 * nome da empresa (nada de clicar por reflexo) e, no caso do cliente, a senha.
 *
 * Usada nos dois lugares que apagam uma empresa — Configurações (o próprio
 * cliente) e o painel da plataforma — para as duas telas avisarem a mesma coisa.
 */
export function DeleteAccountDialog({
  open,
  companyName,
  askPassword,
  busy,
  error,
  onConfirm,
  onClose,
}: DeleteAccountDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [wasOpen, setWasOpen] = useState(open)

  // Zera os campos a cada abertura: o diálogo fica montado o tempo todo, e uma
  // senha digitada numa tentativa não deve estar à espera na seguinte.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setConfirmation('')
      setPassword('')
    }
  }

  const nameMatches = normalize(confirmation) === normalize(companyName)
  const canConfirm = nameMatches && (!askPassword || password.length > 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Excluir empresa por completo?"
      subtitle={companyName}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!canConfirm}
            onClick={() => onConfirm({ confirmation, password })}
          >
            {busy ? 'Excluindo…' : 'Excluir para sempre'}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {error && <Alert tone="danger">{error}</Alert>}

        <Alert tone="danger">
          Isso apaga na hora, e não tem como desfazer: todos os logins e lojas, o cadastro de
          produtos, o estoque, as validades, as quebras, as auditorias, os pedidos e todas as
          fotos e arquivos anexados.
        </Alert>
        <p className={styles.note}>
          Cópias de segurança do banco guardam os dados por mais algum tempo, até a retenção delas
          vencer, e só a plataforma consegue acessá-las.
        </p>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (canConfirm && !busy) onConfirm({ confirmation, password })
          }}
          noValidate
        >
          <TextField
            label={`Digite o nome da empresa: ${companyName}`}
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          {askPassword && (
            <TextField
              label="Sua senha"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              revealable
            />
          )}
        </form>
      </div>
    </Dialog>
  )
}
