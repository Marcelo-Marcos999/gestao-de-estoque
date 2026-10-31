import { Router, raw } from 'express'
import type { Response } from 'express'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { comContextoDoUsuario } from '../db/contexto.js'
import { exigirAutenticacao } from '../auth/middleware.js'
import { assincrono } from '../lib/assincrono.js'
import { apagarArquivo, armazenamentoLigado, guardarArquivo, lerArquivo } from '../lib/armazenamento.js'

export const rotasAnexos = Router()

rotasAnexos.use(exigirAutenticacao)

/**
 * Onde o arquivo mora no bucket: SEMPRE derivado dos ids, nunca informado por
 * quem chama. Assim o "desfazer" da exclusão de um registro pode recriar a linha
 * do anexo sem aceitar um caminho do cliente (que poderia apontar para o arquivo
 * de outra loja) — o arquivo só existe nesse endereço se foi este anexo que o pôs.
 */
export function caminhoDoAnexo(contaId: string, quebraId: string, anexoId: string): string {
  return `${contaId}/${quebraId}/${anexoId}`
}

const TIPOS = ['foto-produto', 'foto-etiqueta', 'documento'] as const

/** Foto (o front reduz antes de enviar) ou PDF: o que alguém tira no corredor ou recebe do fornecedor. */
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])

/** Cabe uma foto de celular sem redução; acima disso é arquivo errado, não anexo. */
export const TAMANHO_MAXIMO = 10 * 1024 * 1024

const consulta = z.object({
  quebra: z.string().uuid(),
  tipo: z.enum(TIPOS),
  nome: z.string().trim().min(1).max(200),
})

const SEM_ARMAZENAMENTO = {
  erro: 'Os anexos ainda não estão ativos neste servidor.',
  codigo: 'armazenamento_indisponivel',
}

/** Metadados no formato que a tela já usa na lista de registros. */
function paraResposta(linha: { id: string; tipo: string; nome_arquivo: string; mime_type: string; tamanho_bytes: string | number }) {
  return {
    id: linha.id,
    tipo: linha.tipo,
    nome: linha.nome_arquivo,
    mime: linha.mime_type,
    tamanho: Number(linha.tamanho_bytes),
  }
}

/**
 * Recebe o arquivo CRU no corpo (não JSON, não multipart): o tipo do conteúdo é o
 * do arquivo, e o resto vai na URL. É o jeito mais simples de enviar um binário e
 * dispensa uma biblioteca de multipart.
 *
 * Um espaço por tipo em cada registro: enviar de novo TROCA o anterior (a tela
 * oferece uma foto do produto, uma da etiqueta e um documento).
 */
rotasAnexos.post(
  '/',
  raw({ type: () => true, limit: TAMANHO_MAXIMO }),
  assincrono(async (req, res) => {
    if (!armazenamentoLigado()) {
      res.status(503).json(SEM_ARMAZENAMENTO)
      return
    }

    const parametros = consulta.safeParse(req.query)
    const mime = (req.header('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
    const conteudo: unknown = req.body

    if (!parametros.success) {
      res.status(400).json({ erro: 'Informe o registro, o tipo e o nome do arquivo.' })
      return
    }
    if (!MIMES.has(mime)) {
      res.status(415).json({ erro: 'Tipo de arquivo não aceito. Envie uma foto (JPG, PNG, WebP) ou um PDF.' })
      return
    }
    if (!Buffer.isBuffer(conteudo) || conteudo.length === 0) {
      res.status(400).json({ erro: 'O arquivo está vazio.' })
      return
    }

    const { quebra, tipo, nome } = parametros.data
    const anexoId = randomUUID()
    const caminho = caminhoDoAnexo(req.sessao!.contaId, quebra, anexoId)

    // O registro precisa ser visível para quem envia: a RLS esconde o de outra
    // loja (operador) ou conta, e o arquivo nem chega a ser guardado.
    const existe = await comContextoDoUsuario(req.sessao!, async (client) => {
      const { rowCount } = await client.query('select 1 from quebras where id = $1', [quebra])
      return (rowCount ?? 0) > 0
    })
    if (!existe) {
      res.status(404).json({ erro: 'Registro não encontrado.' })
      return
    }

    // Arquivo primeiro, linha depois: se o envio falhar, não sobra linha apontando
    // para um arquivo que não existe. Se a linha falhar depois, o arquivo é removido.
    await guardarArquivo(caminho, conteudo, mime)

    let substituido: string | null = null
    let criado
    try {
      criado = await comContextoDoUsuario(req.sessao!, async (client) => {
        const { rows: antigos } = await client.query(
          'delete from anexos where quebra_id = $1 and tipo = $2 returning id',
          [quebra, tipo],
        )
        substituido = antigos.length > 0 ? (antigos[0].id as string) : null
        const { rows } = await client.query(
          `insert into anexos (id, quebra_id, tipo, nome_arquivo, mime_type, tamanho_bytes, storage_path)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning id, tipo, nome_arquivo, mime_type, tamanho_bytes`,
          [anexoId, quebra, tipo, nome, mime, conteudo.length, caminho],
        )
        return rows[0]
      })
    } catch (erro) {
      await apagarArquivo(caminho).catch(() => {})
      throw erro
    }

    // O anterior (se havia) já não tem linha: o arquivo dele pode sair, e sai ANTES
    // de responder para o bucket já estar em ordem quando a tela reler. Falhar aqui
    // deixa um objeto órfão, que custa centavos — não vale desfazer o envio.
    if (substituido) {
      await apagarArquivo(caminhoDoAnexo(req.sessao!.contaId, quebra, substituido)).catch(() => {})
    }
    res.status(201).json(paraResposta(criado))
  }),
)

const parametroId = z.object({ id: z.string().uuid() })

/** O arquivo, só para quem enxerga o registro (a RLS decide); a tela o busca com o próprio token. */
rotasAnexos.get('/:id', assincrono(async (req, res) => {
  const parametros = parametroId.safeParse(req.params)
  if (!parametros.success) {
    res.status(400).json({ erro: 'Anexo inválido.' })
    return
  }
  if (!armazenamentoLigado()) {
    res.status(503).json(SEM_ARMAZENAMENTO)
    return
  }

  const linha = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query(
      'select nome_arquivo, mime_type, storage_path from anexos where id = $1',
      [parametros.data.id],
    )
    return rows[0] as { nome_arquivo: string; mime_type: string; storage_path: string } | undefined
  })
  if (!linha) {
    res.status(404).json({ erro: 'Anexo não encontrado.' })
    return
  }

  const arquivo = await lerArquivo(linha.storage_path)
  if (!arquivo?.body) {
    res.status(404).json({ erro: 'O arquivo deste anexo não está mais disponível.' })
    return
  }

  enviarArquivo(res, arquivo, linha.mime_type, linha.nome_arquivo)
}))

function enviarArquivo(res: Response, arquivo: globalThis.Response, mime: string, nome: string) {
  res.setHeader('content-type', mime)
  const tamanho = arquivo.headers.get('content-length')
  if (tamanho) res.setHeader('content-length', tamanho)
  // O id do anexo nunca muda de conteúdo (trocar o arquivo cria outro id), então
  // o navegador pode guardar — mas só ele, não um cache compartilhado.
  res.setHeader('cache-control', 'private, max-age=3600')
  // `nosniff` do helmet + tipo fixo da lista: um "PDF" não vira página executável.
  res.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(nome)}`)
  Readable.fromWeb(arquivo.body as import('node:stream/web').ReadableStream).pipe(res)
}

rotasAnexos.delete('/:id', assincrono(async (req, res) => {
  const parametros = parametroId.safeParse(req.params)
  if (!parametros.success) {
    res.status(400).json({ erro: 'Anexo inválido.' })
    return
  }

  const removido = await comContextoDoUsuario(req.sessao!, async (client) => {
    const { rows } = await client.query('delete from anexos where id = $1 returning storage_path', [parametros.data.id])
    return rows[0] as { storage_path: string } | undefined
  })
  if (!removido) {
    res.status(404).json({ erro: 'Anexo não encontrado.' })
    return
  }

  if (armazenamentoLigado()) await apagarArquivo(removido.storage_path).catch(() => {})
  res.status(204).end()
}))
