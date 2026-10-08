/**
 * Empacota o app num arquivo HTML único, para publicar como demonstração.
 *
 * A demonstração roda sem servidor: as rotas vão no fragmento (#/quebra) e o
 * CSS e o JS ficam embutidos, porque o visualizador só recebe uma página.
 *
 * Nada aqui altera o app — o desvio do download vive neste empacotamento
 * justamente para o código da aplicação não conhecer a plataforma onde a
 * demonstração é hospedada.
 *
 * Uso: npm run build:demo
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const SAIDA = process.argv[2] ?? 'dist-demo/gestao-validades.html'

execFileSync('npx', ['vite', 'build', '--base', './', '--outDir', 'dist-demo'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_HASH_ROUTER: 'true' },
})

const dir = 'dist-demo/assets'
const arquivos = readdirSync(dir)

/**
 * O empacotamento depende de achar um CSS e um JS gerados pelo Vite. Se algum
 * não existir, seguir em frente embutiria `undefined` no HTML e o arquivo
 * sairia em branco sem dizer por quê — melhor falhar aqui, com o nome da pasta.
 */
const ler = (extensao) => {
  const nome = arquivos.find((f) => f.endsWith(extensao))
  if (!nome) throw new Error(`Nenhum arquivo ${extensao} em ${dir}: o build não gerou o esperado.`)
  return readFileSync(`${dir}/${nome}`, 'utf8')
}

const css = ler('.css')
const js = ler('.js')

/**
 * O visualizador da demonstração não deixa a página baixar arquivo sozinha: o
 * download precisa passar pela API dele, que pede confirmação ao usuário.
 *
 * O app entrega a planilha por um <a download>, como qualquer site. Aqui o
 * clique nesse link é desviado. Guardamos o Blob no momento em que a URL é
 * criada porque o app a revoga logo depois do clique — buscar o conteúdo pela
 * URL depois disso chegaria tarde.
 */
const DESVIO_DE_DOWNLOAD = `
;(() => {
  const blobs = new Map()
  const criarUrl = URL.createObjectURL.bind(URL)
  URL.createObjectURL = (objeto) => {
    const url = criarUrl(objeto)
    if (objeto instanceof Blob) blobs.set(url, objeto)
    return url
  }

  const clicar = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    const blob = this.download && blobs.get(this.href)
    if (!blob) return clicar.call(this)

    const filename = this.download
    Promise.resolve(window.claude?.use?.('downloads'))
      .then((downloads) => {
        if (!downloads) {
          window.alert('Nesta demonstração o download depende da confirmação do visualizador, que não está disponível aqui.')
          return
        }
        return downloads.save({ filename, data: blob })
      })
      // Recusar o download é uma resposta legítima do usuário, não um erro.
      .catch(() => {})
  }
})()
`

/**
 * O arquivo é aberto com dois cliques, sem servidor, então ele é um documento
 * inteiro: sem `<!doctype html>` o navegador abriria em modo de compatibilidade,
 * e sem o `charset` ele adivinharia a codificação — o "demonstração" do aviso
 * acima chegaria à tela com os acentos trocados.
 *
 * O bundle entra como `<script type="module">`: o app é ESM e usa
 * `import.meta.env`, que só existe em módulo. Sem o atributo, o navegador
 * recusaria o arquivo com "Cannot use 'import.meta' outside a module".
 */
const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0d1014" />
    <title>Gestão de Validades</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>${DESVIO_DE_DOWNLOAD}</script>
    <script type="module">
${js}
    </script>
  </body>
</html>
`

writeFileSync(SAIDA, html)
console.log(`\n${SAIDA} — ${(html.length / 1024).toFixed(0)} KB`)
