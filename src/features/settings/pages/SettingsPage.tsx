import { ChangePasswordForm, CompanyPanel, LoginsPanel } from '@/features/account'
import { useAuth } from '@/features/auth'
import { usePersistedState } from '@/shared/hooks/usePersistedState'
import { storageKey } from '@/shared/lib/storage'
import { AppearancePanel } from '../components/AppearancePanel'
import { InstallPanel } from '../components/InstallPanel'
import styles from './SettingsPage.module.css'

type TabId = 'conta' | 'aparencia' | 'aplicativo' | 'logins' | 'empresa'

interface Tab {
  id: TabId
  label: string
  adminOnly: boolean
}

const TABS: Tab[] = [
  { id: 'conta', label: 'Minha conta', adminOnly: false },
  { id: 'aparencia', label: 'Aparência', adminOnly: false },
  { id: 'aplicativo', label: 'Aplicativo', adminOnly: false },
  { id: 'logins', label: 'Lojas e logins', adminOnly: true },
  { id: 'empresa', label: 'Empresa', adminOnly: true },
]

function isTabId(value: unknown): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

/**
 * Configurações. A aba escolhida é lembrada, como qualquer seleção de aba (ver
 * CLAUDE.md, "Filtros e buscas são lembrados").
 *
 * As abas do administrador nem aparecem para o operador: oferecer o que o
 * perfil não pode fazer só revela o erro depois do clique. O servidor recusa do
 * mesmo jeito (esconder é experiência, não segurança).
 */
export function SettingsPage() {
  const { user } = useAuth()
  const [stored, setTab] = usePersistedState<TabId>(storageKey('aba', 'configuracoes'), 'conta', isTabId)

  const isAdmin = user?.role === 'admin'
  const tabs = TABS.filter((tab) => isAdmin || !tab.adminOnly)

  // Uma aba lembrada de quando a pessoa era administradora (ou de outro login
  // no mesmo aparelho) cai em "Minha conta" em vez de abrir uma tela vazia.
  const tab = tabs.some((t) => t.id === stored) ? stored : 'conta'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configurações</h1>
        <span className={styles.subtitle}>{user?.email}</span>
      </header>

      <nav className={styles.tabs} aria-label="Seções de configurações">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${t.id === tab ? styles.active : ''}`}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.content}>
        {tab === 'conta' && <ChangePasswordForm />}
        {tab === 'aparencia' && <AppearancePanel />}
        {tab === 'aplicativo' && <InstallPanel />}
        {tab === 'logins' && isAdmin && <LoginsPanel />}
        {tab === 'empresa' && isAdmin && <CompanyPanel />}
      </div>
    </div>
  )
}
