import { useCallback, useState } from 'react'
import { ApiError } from '@/shared/lib/http'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { DeleteAccountDialog } from '@/shared/ui/DeleteAccountDialog'
import { Logo } from '@/shared/ui/Logo'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'
import { deleteCompany, setCompanyLimits } from '../api'
import { CompanyCard } from '../components/CompanyCard'
import { LimitsDialog } from '../components/LimitsDialog'
import { PlatformLogin } from '../components/PlatformLogin'
import { useCompanies } from '../hooks/useCompanies'
import type { CompanyLimits, PlatformCompany } from '../types'
import styles from './PlatformPage.module.css'

interface PlatformSession {
  token: string
  name: string
}

/**
 * /plataforma — o painel do dono do sistema.
 *
 * O token fica SÓ na memória desta página (nada de localStorage): quem recarrega ou
 * fecha a aba entra de novo. Num painel que lista e apaga todas as empresas, o
 * incômodo de digitar a senha vale a garantia de que nenhum token ficou esquecido no
 * navegador de um computador emprestado.
 */
export function PlatformPage() {
  const [session, setSession] = useState<PlatformSession | null>(null)

  if (!session) {
    return <PlatformLogin onSignedIn={(token, name) => setSession({ token, name })} />
  }
  return <Panel session={session} onSignOut={() => setSession(null)} />
}

function Panel({ session, onSignOut }: { session: PlatformSession; onSignOut: () => void }) {
  const { companies, status, reload, refresh } = useCompanies(session.token, onSignOut)
  const [search, setSearch] = usePersistedState<string>(storageKey('busca', 'plataforma'), '', (v): v is string => typeof v === 'string')

  const [limitsOf, setLimitsOf] = useState<PlatformCompany | null>(null)
  const [deleting, setDeleting] = useState<PlatformCompany | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const term = search.trim().toLowerCase()
  const visible = term
    ? companies.filter((c) => c.name.toLowerCase().includes(term) || (c.adminEmail ?? '').toLowerCase().includes(term))
    : companies

  // 401 no meio de uma ação (token de 1 hora vencido) devolve ao login; o resto vira mensagem.
  const fail = useCallback(
    (erro: unknown, fallback: string) => {
      if (erro instanceof ApiError && erro.status === 401) onSignOut()
      else setError(erro instanceof ApiError ? erro.message : fallback)
    },
    [onSignOut],
  )

  async function handleSaveLimits(limits: CompanyLimits) {
    if (!limitsOf) return
    setError(null)
    setBusy(true)
    try {
      await setCompanyLimits(session.token, limitsOf.id, limits)
      setNotice(`Limites de ${limitsOf.name} atualizados.`)
      setLimitsOf(null)
      await refresh()
    } catch (erro) {
      fail(erro, 'Não foi possível salvar os limites. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete({ confirmation }: { confirmation: string }) {
    if (!deleting) return
    setError(null)
    setBusy(true)
    try {
      const { filesDeleted } = await deleteCompany(session.token, deleting.id, confirmation)
      setNotice(`${deleting.name} foi excluída (${filesDeleted.toLocaleString('pt-BR')} arquivo(s) removido(s)).`)
      setDeleting(null)
      await refresh()
    } catch (erro) {
      fail(erro, 'Não foi possível excluir agora. Nada foi apagado; tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Logo size={32} markOnly />
          <div>
            <h1 className={styles.title}>Plataforma</h1>
            <span className={styles.subtitle}>{session.name}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={onSignOut}>
          Sair
        </Button>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar empresa ou e-mail"
          aria-label="Buscar empresa ou e-mail"
        />
        {search && (
          <Button variant="ghost" onClick={() => setSearch('')}>
            Limpar busca
          </Button>
        )}
      </div>

      {status === 'loading' && <p className={styles.text}>Carregando…</p>}
      {status === 'error' && (
        <>
          <Alert tone="danger">Não foi possível carregar as empresas.</Alert>
          <div>
            <Button variant="secondary" onClick={reload}>
              Tentar de novo
            </Button>
          </div>
        </>
      )}

      {status === 'ready' && (
        <>
          <p className={styles.text}>
            {term
              ? `${visible.length} de ${companies.length} empresas`
              : `${companies.length.toLocaleString('pt-BR')} ${companies.length === 1 ? 'empresa' : 'empresas'}`}
          </p>
          <ul className={styles.list}>
            {visible.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                onEditLimits={() => {
                  setError(null)
                  setNotice(null)
                  setLimitsOf(company)
                }}
                onDelete={() => {
                  setError(null)
                  setNotice(null)
                  setDeleting(company)
                }}
              />
            ))}
          </ul>
          {visible.length === 0 && <p className={styles.text}>Nenhuma empresa encontrada.</p>}
        </>
      )}

      <LimitsDialog
        company={limitsOf}
        busy={busy}
        error={error}
        onSave={handleSaveLimits}
        onClose={() => setLimitsOf(null)}
      />
      <DeleteAccountDialog
        open={deleting !== null}
        companyName={deleting?.name ?? ''}
        askPassword={false}
        busy={busy}
        error={error}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
