import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { ApiError } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { DeleteAccountDialog } from '@/shared/ui/DeleteAccountDialog'
import { deleteCompany } from '../api'
import styles from './panel.module.css'

/**
 * "Zona de perigo": o administrador apaga a própria empresa por completo.
 *
 * Fica por último e separada das outras seções de propósito, e a ação só
 * acontece depois do nome da empresa e da senha digitados (ver o diálogo). Depois
 * de apagar, a sessão não tem mais a quem pertencer: sai para a tela de entrada.
 */
export function DeleteCompanyPanel({ companyName }: { companyName: string }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm({ confirmation, password }: { confirmation: string; password: string }) {
    setError(null)
    setBusy(true)
    try {
      await deleteCompany(confirmation, password)
      signOut()
      navigate('/entrar', { replace: true })
    } catch (erro) {
      setError(messageFor(erro))
      setBusy(false)
    }
  }

  return (
    <section className={`${styles.panel} ${styles.danger}`} aria-labelledby="delete-company-title">
      <h2 className={styles.title} id="delete-company-title">
        Excluir empresa
      </h2>
      <p className={styles.text}>
        Apaga a empresa por completo e na hora: todos os logins, produtos, estoque, registros e os
        arquivos anexados. Não dá para desfazer. Se só precisa tirar o acesso de alguém, desative o
        login em &quot;Lojas e logins&quot;.
      </p>
      <div className={styles.actions}>
        <Button
          variant="danger"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          Excluir minha empresa…
        </Button>
      </div>

      <DeleteAccountDialog
        open={open}
        companyName={companyName}
        askPassword
        busy={busy}
        error={error}
        onConfirm={handleConfirm}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}

function messageFor(erro: unknown): string {
  if (erro instanceof ApiError) {
    // 403 aqui é senha errada; 400, nome que não confere; 429, tentativas demais.
    if (erro.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
    return erro.message
  }
  return 'Não foi possível excluir agora. Nada foi apagado; tente de novo.'
}
