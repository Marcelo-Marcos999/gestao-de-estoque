/*
 * Service worker do app instalado.
 *
 * Escopo deliberadamente pequeno. Ele existe para duas coisas:
 *   1. o navegador oferecer "Instalar aplicativo";
 *   2. o app instalado abrir mesmo sem rede, mostrando a própria tela de erro
 *      em vez da página de "sem conexão" do navegador.
 *
 * Ele NÃO guarda dados do usuário e NÃO faz o sistema funcionar offline: toda
 * lista, lote e quebra vem da API (outra origem, que este arquivo nem
 * intercepta). Guardar resposta de API aqui exigiria decidir o que fazer com
 * edição offline e conflito — decisão de produto, não de cache.
 *
 * O que fica em cache é só código público (HTML e JS/CSS do build), igual para
 * qualquer pessoa, então trocar de login no mesmo aparelho não vaza nada.
 */

// Mudar este número descarta tudo que um service worker antigo guardou.
const VERSAO = 'v1'
const CACHE_ASSETS = `assets-${VERSAO}`
const CACHE_CASCA = `casca-${VERSAO}`

// Endereço do index.html relativo ao escopo, para funcionar também quando o
// app mora numa subpasta (GitHub Pages).
const CASCA = new URL('./index.html', self.registration.scope).href

self.addEventListener('install', () => {
  // Assume o controle sem esperar todas as abas fecharem: o app é
  // versionado pelo nome dos arquivos, então código novo nunca se mistura com
  // o antigo, e o aparelho de loja raramente fecha o app de verdade.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys()
      await Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_ASSETS && nome !== CACHE_CASCA)
          .map((nome) => caches.delete(nome)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Só a própria origem: API, fontes e qualquer terceiro seguem direto para a
  // rede, sem passar por aqui.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(abrirPagina(request))
    return
  }

  // O Vite põe um hash no nome de cada arquivo de /assets/: o conteúdo de um
  // nome nunca muda, então o cache nunca fica velho.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(doCacheOuRede(request))
  }
})

/**
 * Páginas: rede primeiro, para quem está online sempre receber a versão
 * recém-publicada; se a rede falhar, a última casca guardada.
 */
async function abrirPagina(request) {
  try {
    const resposta = await fetch(request)
    // Toda rota do app devolve o mesmo index.html (SPA), então basta guardar
    // uma cópia só, e não uma por endereço visitado.
    if (resposta.ok && resposta.headers.get('content-type')?.includes('text/html')) {
      const cache = await caches.open(CACHE_CASCA)
      await cache.put(CASCA, resposta.clone())
    }
    return resposta
  } catch (erro) {
    const guardada = await caches.match(CASCA)
    if (guardada) return guardada
    throw erro
  }
}

/** Assets com hash: o que já está guardado vale para sempre. */
async function doCacheOuRede(request) {
  const cache = await caches.open(CACHE_ASSETS)
  const guardado = await cache.match(request)
  if (guardado) return guardado

  const resposta = await fetch(request)
  // Só guarda resposta de verdade: um 404 em cache faria o app quebrar mesmo
  // depois de o arquivo certo ser publicado.
  if (resposta.ok) await cache.put(request, resposta.clone())
  return resposta
}
