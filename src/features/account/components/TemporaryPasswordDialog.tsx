import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import styles from './LoginsPanel.module.css'

interface TemporaryPasswordDialogProps {
  open: boolean
  /** Para quem é a senha: aparece junto, porque quem anota precisa saber de qual login ela é. */
  email: string
  password: string
  onClose: () => void
}

/**
 * Mostra a senha provisória uma única vez.
 *
 * O banco guarda só o hash, então não há como mostrá-la de novo: fechar este
 * diálogo sem anotar significa gerar outra. Por isso ele não fecha ao clicar
 * fora — só no botão (ver `Dialog`) — e o aviso fica à vista.
 */
export function TemporaryPasswordDialog({ open, email, password, onClose }: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied('ok')
    } catch {
      // Sem permissão de área de transferência (ou HTTP): a pessoa copia na mão.
      setCopied('fail')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Senha provisória"
      subtitle={email}
      footer={<Button onClick={onClose}>Anotei, fechar</Button>}
      dismissible={false}
    >
      <div className={styles.passwordBody}>
        <Alert tone="info">
          Esta senha aparece <strong>só agora</strong>. Se fechar sem anotar, será preciso gerar outra.
        </Alert>

        <code className={styles.password} aria-label="Senha provisória">
          {password}
        </code>

        <Button variant="secondary" onClick={() => void copy()}>
          {copied === 'ok' ? 'Copiada' : 'Copiar senha'}
        </Button>
        {copied === 'fail' && (
          <p className={styles.note}>Não consegui copiar sozinho. Selecione a senha acima e copie.</p>
        )}

        <p className={styles.note}>
          Peça para a pessoa trocar a senha em <strong>Configurações → Minha conta</strong> no primeiro
          acesso.
        </p>
      </div>
    </Dialog>
  )
}
