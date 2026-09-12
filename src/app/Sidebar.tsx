import { NavLink } from 'react-router-dom'
import { Logo } from '@/shared/ui/Logo'
import { Button } from '@/shared/ui/Button'
import {
  ArrowLeftIcon,
  BarcodeIcon,
  BoxIcon,
  CalendarIcon,
  LayersIcon,
  MoonIcon,
  SettingsIcon,
  SidebarIcon,
  SunIcon,
} from '@/shared/ui/icons'
import { useAuth } from '@/features/auth'
import { useAppearance } from '@/features/settings'
import styles from './AppShell.module.css'

/**
 * Itens do menu.
 *
 * `adminOnly` esconde a entrada do operador. O cadastro de produtos é a bancada
 * do administrador: o operador alcança os produtos pela busca dentro do
 * registro de quebra, não por um item de menu — para ele aquela tela seria um
 * beco sem saída (ver docs/dominio.md).
 */
const NAV = [
  { to: '/validades', label: 'Validades', icon: CalendarIcon, ready: true, adminOnly: false },
  { to: '/quebra', label: 'Quebra', icon: BarcodeIcon, ready: true, adminOnly: false },
  // Estoque é lido e importado pelos dois perfis: saldo, saídas, custo e
  // venda não são a bancada do administrador, diferente do cadastro abaixo
  // (ver CLAUDE.md, "Perfis de acesso").
  { to: '/estoque', label: 'Estoque', icon: LayersIcon, ready: true, adminOnly: false },
  {
    to: '/produtos',
    label: 'Cadastro de produtos',
    icon: BoxIcon,
    ready: true,
    adminOnly: true,
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: SettingsIcon,
    ready: false,
    adminOnly: false,
  },
]

interface SidebarProps {
  /** Aberta como gaveta sobre o conteúdo — só existe no celular. */
  open: boolean
  /** Recolhida à coluna dos ícones — só existe da largura de tablet para cima. */
  collapsed: boolean
  onNavigate: () => void
  onToggleCollapsed: () => void
}

export function Sidebar({ open, collapsed, onNavigate, onToggleCollapsed }: SidebarProps) {
  const { user, signOut } = useAuth()
  const { resolvedMode, setMode } = useAppearance()

  return (
    <aside
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''} ${
        collapsed ? styles.collapsed : ''
      }`}
    >
      <div className={styles.brand}>
        <Logo size={36} markOnly={collapsed} />

        {/* Só existe na coluna fixa: no celular a barra é uma gaveta, e ali
            quem a fecha é o Esc, o fundo escuro ou a própria navegação. */}
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <SidebarIcon width={20} height={20} />
        </button>
      </div>

      <nav className={styles.nav}>
        {NAV.filter((item) => !item.adminOnly || user?.role === 'admin').map(
          ({ to, label, icon: Icon, ready }) =>
            ready ? (
              <NavLink
                key={to}
                to={to}
                // Recolhida, o rótulo some da tela mas não do elemento: o title
                // dá a dica ao mouse e o texto continua no leitor de tela.
                title={collapsed ? label : undefined}
                // Navegar fecha a gaveta: deixá-la aberta sobre a tela nova é
                // desorientador. É consequência do clique, não de um efeito
                // observando a rota depois que ela já mudou.
                onClick={onNavigate}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <Icon />
                <span className={styles.navLabel}>{label}</span>
              </NavLink>
            ) : (
              <span
                key={to}
                className={styles.navItem}
                aria-disabled="true"
                title={collapsed ? `${label} — em breve` : undefined}
              >
                <Icon />
                <span className={styles.navLabel}>{label}</span>
                <span className={styles.navSoon}>em breve</span>
              </span>
            ),
        )}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.user}>
          <span className={styles.userName}>{user?.name}</span>
          <span className={styles.userRole}>
            {user?.role === 'admin' ? 'Administrador' : 'Operador'}
          </span>
        </div>

        <div className={styles.sidebarActions}>
          <Button
            variant="secondary"
            onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
            aria-label={resolvedMode === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            {resolvedMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </Button>
          <Button
            variant="secondary"
            fullWidth={!collapsed}
            onClick={signOut}
            aria-label="Sair"
            title={collapsed ? 'Sair' : undefined}
          >
            {collapsed ? <ArrowLeftIcon /> : 'Sair'}
          </Button>
        </div>
      </div>
    </aside>
  )
}
