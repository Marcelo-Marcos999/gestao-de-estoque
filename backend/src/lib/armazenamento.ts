import { AwsClient } from 'aws4fetch'

/**
 * Guarda os arquivos dos anexos num bucket compatível com S3 — em produção, o R2
 * da Cloudflare.
 *
 * `aws4fetch` e não o SDK da AWS: o R2 só precisa de requisições HTTP assinadas
 * (SigV4), e a biblioteca faz exatamente isso, com `fetch`, sem puxar dezenas de
 * dependências. É também o que a documentação da Cloudflare mostra para o R2.
 *
 * Sem as variáveis de ambiente, o armazenamento fica DESLIGADO e o resto do
 * sistema segue igual: `/auth/recursos` avisa a tela, que esconde os anexos em
 * vez de aceitar um arquivo que não teria onde morar (mesmo desenho do e-mail).
 */
const idDaConta = process.env.R2_ACCOUNT_ID
const chave = process.env.R2_ACCESS_KEY_ID
const segredo = process.env.R2_SECRET_ACCESS_KEY
const balde = process.env.R2_BUCKET
// `R2_ENDPOINT` existe para apontar a outro servidor S3 (os testes usam um local).
const endpoint = (process.env.R2_ENDPOINT ?? (idDaConta ? `https://${idDaConta}.r2.cloudflarestorage.com` : '')).replace(/\/$/, '')

const cliente =
  chave && segredo
    ? new AwsClient({ accessKeyId: chave, secretAccessKey: segredo, service: 's3', region: 'auto' })
    : null

export function armazenamentoLigado(): boolean {
  return Boolean(cliente && balde && endpoint)
}

/** Endereço do objeto no estilo "path": `endpoint/balde/chave`. */
function endereco(caminho: string): string {
  return `${endpoint}/${balde}/${caminho.split('/').map(encodeURIComponent).join('/')}`
}

function exigirLigado(): AwsClient {
  if (!cliente || !armazenamentoLigado()) throw new Error('Armazenamento de arquivos não configurado.')
  return cliente
}

export async function guardarArquivo(caminho: string, conteudo: Buffer, mime: string): Promise<void> {
  const resposta = await exigirLigado().fetch(endereco(caminho), {
    method: 'PUT',
    body: new Uint8Array(conteudo),
    headers: { 'content-type': mime },
  })
  if (!resposta.ok) throw new Error(`Falha ao guardar o arquivo (${resposta.status}).`)
}

/** A resposta do bucket já com o corpo em fluxo; `null` quando o arquivo não existe. */
export async function lerArquivo(caminho: string): Promise<Response | null> {
  const resposta = await exigirLigado().fetch(endereco(caminho))
  if (resposta.status === 404) return null
  if (!resposta.ok) throw new Error(`Falha ao ler o arquivo (${resposta.status}).`)
  return resposta
}

/** Apagar o que já não existe não é erro: o resultado desejado é o mesmo. */
export async function apagarArquivo(caminho: string): Promise<void> {
  const resposta = await exigirLigado().fetch(endereco(caminho), { method: 'DELETE' })
  if (!resposta.ok && resposta.status !== 404) throw new Error(`Falha ao apagar o arquivo (${resposta.status}).`)
}
