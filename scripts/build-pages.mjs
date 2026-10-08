/**
 * Build para o GitHub Pages.
 *
 * Acrescenta ao build normal duas coisas que só aquele servidor pede:
 *
 * 1. `404.html`, cópia do `index.html`. O Pages não sabe que somos uma
 *    aplicação de página única: pedir /validades direto na barra de endereços,
 *    ou recarregar ali, procuraria um arquivo que não existe. Ele então serve
 *    o 404 — que sendo o mesmo HTML, carrega o app, e o roteador resolve o
 *    endereço no navegador.
 *
 * 2. `.nojekyll`, senão o Pages processa a pasta com o Jekyll e descarta os
 *    arquivos começados por underscore.
 *
 * Uso: npm run build:pages
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })

/**
 * Só publicamos um HTML que carregue o bundle como módulo.
 *
 * O app inteiro é ESM e `src/main.tsx` lê `import.meta.env` para escolher o
 * roteador e a base do endereço. Se o <script> que aponta para o bundle saísse
 * sem `type="module"`, o navegador o executaria como script clássico e a página
 * pararia com "Cannot use 'import.meta' outside a module". Conferir aqui evita
 * descobrir isso só depois de publicado, no site no ar.
 */
const html = readFileSync('dist/index.html', 'utf8')
const comSrc = [...html.matchAll(/<script\b[^>]*\bsrc\s*=[^>]*>/gi)].map((m) => m[0])
const semModulo = comSrc.filter((tag) => !/\btype\s*=\s*["']module["']/i.test(tag))

if (!comSrc.length) {
  throw new Error('dist/index.html não carrega nenhum script — o build não gerou o esperado.')
}
if (semModulo.length) {
  throw new Error(
    `dist/index.html carrega ${semModulo.join(', ')} sem type="module": o app não abriria.`,
  )
}

copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')

console.log('\ndist/ pronto para o GitHub Pages (404.html e .nojekyll incluídos)')
