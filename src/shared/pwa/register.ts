/**
 * Registra o service worker (`public/sw.js`), que torna o app instalável e
 * deixa o aplicativo instalado abrir mesmo sem rede.
 *
 * Só em produção: em desenvolvimento um service worker serviria arquivos
 * antigos do cache e faria a pessoa depurar código que já não está rodando.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // A demonstração em arquivo único não é servida de um endereço próprio, e o
  // service worker não existiria ali.
  if (import.meta.env.VITE_HASH_ROUTER === 'true') return

  const base = import.meta.env.BASE_URL
  if (!base.startsWith('/')) return

  // Esperar o carregamento terminar evita que o registro dispute banda com o
  // primeiro desenho da tela, que é o que o operador está esperando.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
      // Falhar aqui só tira a instalação; o sistema segue funcionando.
      console.warn('Não foi possível registrar o service worker', error)
    })
  })
}
