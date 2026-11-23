#!/usr/bin/env node
/**
 * Fala com o bucket de backups (R2 da Cloudflare, ou qualquer servidor S3).
 *
 * Uso:
 *   node r2.mjs enviar <arquivo> <chave>
 *   node r2.mjs baixar <chave> <arquivo>
 *   node r2.mjs listar <prefixo>      (uma chave por linha)
 *   node r2.mjs apagar <chave>
 *
 * Por que um script Node e não o `aws` da linha de comando: ele já vem no
 * projeto (`aws4fetch`, o mesmo dos anexos), roda igual no computador de quem
 * está restaurando um desastre, e dá para testar contra um S3 falso sem
 * instalar nada. As variáveis têm prefixo BACKUP_ de propósito: são OUTRO
 * bucket e OUTRA chave de acesso que a dos anexos. Quem consegue apagar anexo
 * não deve conseguir apagar o backup.
 */
import { readFile, stat, writeFile } from 'node:fs/promises'
import { AwsClient } from 'aws4fetch'

const {
  BACKUP_R2_ACCOUNT_ID: conta,
  BACKUP_R2_ACCESS_KEY_ID: chave,
  BACKUP_R2_SECRET_ACCESS_KEY: segredo,
  BACKUP_R2_BUCKET: balde,
  // Existe para os testes apontarem a um S3 local.
  BACKUP_R2_ENDPOINT: endpointManual,
} = process.env

const faltando = [
  ['BACKUP_R2_ACCESS_KEY_ID', chave],
  ['BACKUP_R2_SECRET_ACCESS_KEY', segredo],
  ['BACKUP_R2_BUCKET', balde],
  ['BACKUP_R2_ACCOUNT_ID', endpointManual ? 'ok' : conta],
]
  .filter(([, valor]) => !valor)
  .map(([nome]) => nome)

if (faltando.length > 0) {
  // Só os nomes: o valor de um segredo nunca vai para o log.
  console.error(`Faltam variáveis de ambiente: ${faltando.join(', ')}`)
  process.exit(2)
}

const endpoint = (endpointManual ?? `https://${conta}.r2.cloudflarestorage.com`).replace(/\/$/, '')
const cliente = new AwsClient({ accessKeyId: chave, secretAccessKey: segredo, service: 's3', region: 'auto' })

const enderecoDe = (caminho) => `${endpoint}/${balde}/${caminho.split('/').map(encodeURIComponent).join('/')}`

async function exigirOk(resposta, acao) {
  if (resposta.ok) return resposta
  // O corpo do erro do S3 diz o motivo (chave errada, bucket inexistente...).
  const corpo = (await resposta.text()).slice(0, 300)
  throw new Error(`${acao} falhou (${resposta.status}): ${corpo}`)
}

async function enviar(arquivo, caminho) {
  const { size } = await stat(arquivo)
  // O arquivo todo vai na memória: um PUT único é o que o R2 aceita sem
  // multipart (até 5 GB), e o runner tem 7 GB. Se o banco passar de alguns GB,
  // é a hora de trocar por envio em partes.
  const corpo = await readFile(arquivo)
  const resposta = await cliente.fetch(enderecoDe(caminho), {
    method: 'PUT',
    body: corpo,
    headers: { 'content-type': 'application/octet-stream', 'content-length': String(size) },
  })
  await exigirOk(resposta, 'Envio')
  console.log(`enviado ${caminho} (${size} bytes)`)
}

async function baixar(caminho, arquivo) {
  const resposta = await exigirOk(await cliente.fetch(enderecoDe(caminho)), 'Download')
  await writeFile(arquivo, Buffer.from(await resposta.arrayBuffer()))
  console.log(`baixado ${caminho}`)
}

const desescapar = (xml) =>
  xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

async function listar(prefixo) {
  let token = null
  do {
    const consulta = new URLSearchParams({ 'list-type': '2', prefix: prefixo })
    if (token) consulta.set('continuation-token', token)
    const resposta = await exigirOk(await cliente.fetch(`${endpoint}/${balde}?${consulta}`), 'Listagem')
    const xml = await resposta.text()
    for (const [, k] of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) console.log(desescapar(k))
    // A listagem vem em páginas de até 1000; sem seguir o token, a retenção
    // enxergaria só as primeiras e deixaria o resto envelhecer para sempre.
    token = xml.includes('<IsTruncated>true</IsTruncated>')
      ? desescapar(xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1] ?? '') || null
      : null
  } while (token)
}

async function apagar(caminho) {
  const resposta = await cliente.fetch(enderecoDe(caminho), { method: 'DELETE' })
  if (resposta.status !== 404) await exigirOk(resposta, 'Exclusão')
  console.log(`apagado ${caminho}`)
}

const [, , comando, a, b] = process.argv
const usos = { enviar: [enviar, 2], baixar: [baixar, 2], listar: [listar, 1], apagar: [apagar, 1] }
const uso = usos[comando]
if (!uso || [a, b].filter(Boolean).length < uso[1]) {
  console.error('Uso: r2.mjs enviar <arquivo> <chave> | baixar <chave> <arquivo> | listar <prefixo> | apagar <chave>')
  process.exit(2)
}

uso[0](a, b).catch((erro) => {
  console.error(erro.message)
  process.exit(1)
})
