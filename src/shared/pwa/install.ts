/**
 * Estado da instalação do app (PWA), fora do React.
 *
 * O navegador dispara `beforeinstallprompt` UMA vez, logo ao carregar a página
 * — muito antes de a pessoa abrir Configurações. Se só a tela escutasse, o
 * evento já teria passado e o botão "Instalar" nunca apareceria. Por isso quem
 * escuta é este módulo, iniciado no `main.tsx`, e a tela apenas lê o resultado.
 */
import { useSyncExternalStore } from 'react'

/** O evento não está nos tipos do TypeScript: só Chromium (Chrome, Edge, Opera) o tem. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * - `instalado`: já roda como app (janela própria) — nada a oferecer;
 * - `disponivel`: o navegador liberou o diálogo de instalação;
 * - `ios`: o iPhone/iPad não tem diálogo; a instalação é um passo manual no Safari;
 * - `indisponivel`: o navegador não ofereceu (Firefox, ou já instalado e aberto na aba).
 */
export type InstallState = 'instalado' | 'disponivel' | 'ios' | 'indisponivel'

let deferred: BeforeInstallPromptEvent | null = null
let installedNow = false
let snapshot: InstallState = compute()
const listeners = new Set<() => void>()

/** Janela própria: Chrome/Edge/Android via media query; Safari do iOS via `navigator.standalone`. */
function isStandalone(): boolean {
  try {
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

/** iPadOS 13+ se apresenta como Mac; o toque o denuncia. */
function isIos(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

function compute(): InstallState {
  if (installedNow || isStandalone()) return 'instalado'
  if (deferred) return 'disponivel'
  if (isIos()) return 'ios'
  return 'indisponivel'
}

function update() {
  const next = compute()
  if (next === snapshot) return
  // O snapshot só muda quando o valor muda: useSyncExternalStore compara por
  // identidade e re-renderizaria sem parar se devolvêssemos um objeto novo.
  snapshot = next
  listeners.forEach((listener) => listener())
}

/** Começa a escutar o navegador. Chamar uma vez, o mais cedo possível. */
export function watchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem isto o Chrome mostraria a própria barrinha no momento que quisesse;
    // guardamos o evento para oferecer o botão onde faz sentido.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    update()
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    installedNow = true
    update()
  })

  // Quem instala e abre pelo ícone sai da aba: a tela reflete a troca de modo.
  window
    .matchMedia('(display-mode: standalone)')
    .addEventListener('change', update)

  update()
}

/** Abre o diálogo de instalação do navegador. Devolve se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const event = deferred
  // O evento só pode ser usado uma vez; aceitando ou recusando, o navegador
  // só libera um novo depois de um tempo.
  deferred = null
  update()

  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, () => snapshot)
}
