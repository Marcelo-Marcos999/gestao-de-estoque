/**
 * Gera os ícones PNG do app instalado a partir do mesmo desenho do logotipo.
 *
 * Por que PNG se já existe um SVG: o Android e o Windows aceitam SVG no
 * manifesto, mas o iOS só usa PNG no apple-touch-icon, e o Chrome só
 * considera o app instalável com ícones de 192 e 512 px. Gerar tudo daqui
 * garante que os quatro arquivos nunca divergem do desenho original.
 *
 * Os dois "maskable" têm o desenho reduzido e o fundo sangrando até a borda: o
 * Android recorta o ícone em círculo, quadrado arredondado etc., e só a área
 * central (80%) é garantida visível.
 *
 * Uso: node scripts/gerar-icones.mjs   (precisa do Playwright, já é devDependency)
 */
import { chromium } from 'playwright'

const FUNDO = '#161a21'
const FAIXA = `
  <rect x="115" y="115" width="64" height="282" rx="32" fill="#e5484d"/>
  <rect x="224" y="166" width="64" height="231" rx="32" fill="#f0a726"/>
  <rect x="333" y="230" width="64" height="167" rx="32" fill="#30a46c"/>`

// Ícone comum: cantos arredondados, como o logotipo.
const comum = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${FUNDO}"/>${FAIXA}</svg>`

// Maskable: fundo sem cantos e desenho a 70% no centro.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${FUNDO}"/>
  <g transform="translate(256 256) scale(0.7) translate(-256 -256)">${FAIXA}</g></svg>`

// iOS aplica o próprio arredondamento: entrega o quadrado inteiro.
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${FUNDO}"/>
  <g transform="translate(256 256) scale(0.8) translate(-256 -256)">${FAIXA}</g></svg>`

const SAIDAS = [
  ['public/icons/icone-192.png', comum, 192],
  ['public/icons/icone-512.png', comum, 512],
  ['public/icons/icone-maskable-512.png', maskable, 512],
  ['public/icons/apple-touch-icon.png', apple, 180],
]

// CHROMIUM_PATH existe para ambientes (como CI) em que o navegador já vem
// instalado fora do cache do Playwright.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()
for (const [arquivo, svg, tamanho] of SAIDAS) {
  await page.setViewportSize({ width: tamanho, height: tamanho })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${tamanho}px;height:${tamanho}px}</style>${svg}`,
  )
  await page.screenshot({ path: arquivo, omitBackground: true })
  console.log('gerado', arquivo)
}
await browser.close()
