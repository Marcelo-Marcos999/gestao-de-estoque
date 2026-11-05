import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Logo } from '@/shared/ui/Logo'
import { MenuIcon } from '@/shared/ui/icons'
import { useFocusMode, useSidebarCollapsed } from '@/shared/hooks/useLayoutPreferences'
import { useResumeDraft } from '@/features/breakage'
import { Sidebar } from './Sidebar'
import styles from './AppShell.module.css'

export function AppShell() {
  // Registro de quebra que ficou pela metade volta sozinho (ver `useResumeDraft`).
  useResumeDraft()
  const [menuOpen, setMenuOpen] = useState(false)
  const sidebar = useSidebarCollapsed()

  // O modo foco recolhe a barra junto, sem apagar a preferência de quem a
  // deixou aberta: ao sair do foco, ela volta como estava.
  const { focused } = useFocusMode()
  const collapsed = sidebar.collapsed || focused

  // Esc fecha a gaveta. Sem isto, quem navega por teclado fica preso: o menu
  // cobre a tela e a única saída seria alcançar o fundo escuro com o mouse.
  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ''}`}>
      {menuOpen && (
        <button
          type="button"
          className={styles.scrim}
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <Sidebar
        open={menuOpen}
        collapsed={collapsed}
        onNavigate={() => setMenuOpen(false)}
        onToggleCollapsed={sidebar.toggle}
      />

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
          >
            <MenuIcon />
          </button>
          <Logo size={30} markOnly />
          <strong>Gestão de Validades</strong>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
