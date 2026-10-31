import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { AuthProvider } from '@/features/auth'
import { AppearanceProvider } from '@/features/settings'
import { AppRoutes } from '@/app/routes'
import { watchInstallPrompt } from '@/shared/pwa/install'
import { registerServiceWorker } from '@/shared/pwa/register'
import './styles/global.css'

/**
 * O build de demonstração roda como arquivo único, sem servidor que saiba
 * responder às rotas — nesse caso o endereço vai no fragmento (#/entrar).
 * Em produção o roteamento é por caminho normal.
 */
const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter

/**
 * O prefixo do endereço, quando o app não está na raiz do domínio.
 *
 * O Vite entrega aqui o mesmo valor de `base` do build. No GitHub Pages ele é
 * "/gestao-de-estoque/", e sem passá-lo ao roteador nenhuma rota casaria: toda
 * navegação cairia no redirecionamento de endereço desconhecido.
 *
 * Só vale um caminho absoluto. O build de arquivo único usa base "./", que é
 * relativo e não é prefixo de endereço nenhum — passá-lo ao roteador deixava a
 * demonstração em branco, sem erro no console, porque nenhuma rota batia.
 */
const base = import.meta.env.BASE_URL
const basename = base.startsWith('/') ? base : undefined

// Antes de montar o React: o aviso de "instalável" do navegador chega cedo e
// não se repete (ver shared/pwa/install.ts).
watchInstallPrompt()
registerServiceWorker()

const container = document.getElementById('root')
if (!container) throw new Error('Elemento #root não encontrado no index.html')

createRoot(container).render(
  <StrictMode>
    <Router basename={basename}>
      <AppearanceProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </AppearanceProvider>
    </Router>
  </StrictMode>,
)
