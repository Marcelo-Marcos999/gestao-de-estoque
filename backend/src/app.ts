import compression from 'compression'
import cors from 'cors'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import { registrarRequisicoes } from './lib/registro.js'
import { rotasAuth } from './rotas/auth.js'
import { rotasCadastro } from './rotas/cadastro.js'
import { rotasConta } from './rotas/conta.js'
import { rotasEstoque } from './rotas/estoque.js'
import { rotasLojas } from './rotas/lojas.js'
import { rotasMotivos, rotasOrigens } from './rotas/etiquetas.js'
import { rotasProdutos } from './rotas/produtos.js'
import { rotasAnexos } from './rotas/anexos.js'
import { rotasQuebras } from './rotas/quebras.js'
import { rotasValidades } from './rotas/validades.js'

export function criarApp() {
  const app = express()

  // O Render coloca um proxy na frente do app e repassa o IP real de quem
  // chamou em X-Forwarded-For. Sem isto o Express enxerga o IP do proxy em
  // todas as requisições, e o limite de tentativas de login (rotas/auth.ts)
  // contaria todo mundo junto: 10 erros de senha de qualquer pessoa
  // bloqueariam o login de todas as outras. O `1` é o número de proxies
  // confiáveis (só o do Render); um valor maior deixaria o cliente forjar o
  // IP mandando o próprio cabeçalho.
  app.set('trust proxy', 1)

  // Primeiro de todos: assim também registra o que é recusado antes de chegar a
  // uma rota (corpo grande demais, JSON quebrado).
  app.use(registrarRequisicoes)

  // Cabeçalhos de segurança padrão (HSTS, no-sniff, etc.) — sem isso o
  // Express não manda nenhum.
  app.use(helmet())

  // Respostas em JSON comprimidas (gzip): a lista de 26 mil produtos tem 6 MB e
  // vai a menos de 1 MB — o que pesa no 4G do corredor. Foto e PDF não entram:
  // já vêm comprimidos, e o filtro padrão do pacote só comprime texto.
  app.use(compression())

  const origensPermitidas = (process.env.CORS_ORIGENS ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean)

  app.use(
    cors({
      // Lista explícita, nunca '*': com cookies/Authorization de verdade,
      // CORS aberto pra qualquer origem anula a proteção que ele existe
      // pra dar.
      origin: origensPermitidas,
    }),
  )

  app.use(express.json({ limit: '1mb' }))

  app.get('/saude', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/auth', rotasAuth)
  // Mesmo prefixo: login, cadastro e recuperação de senha são o "lado de fora"
  // da autenticação, sem sessão. Rotas de quem já está logado ficam em /conta.
  app.use('/auth', rotasCadastro)
  app.use('/conta', rotasConta)
  app.use('/lojas', rotasLojas)
  app.use('/produtos', rotasProdutos)
  app.use('/estoque', rotasEstoque)
  app.use('/validades', rotasValidades)
  app.use('/quebras', rotasQuebras)
  app.use('/anexos', rotasAnexos)
  app.use('/motivos', rotasMotivos)
  app.use('/origens', rotasOrigens)

  // Último `app.use`, com 4 parâmetros — é assim que o Express reconhece um
  // middleware de ERRO em vez de uma rota normal. Toda rota é envolvida com
  // `assincrono()` (ver lib/assincrono.ts), que entrega qualquer rejeição
  // aqui em vez de deixar o processo inteiro cair — quem chega até aqui
  // nunca viu a causa real do erro, só um 500 genérico; os detalhes vão pro
  // log do servidor, não pra resposta.
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Corpo maior que o limite (1 MB de JSON; 10 MB num anexo) é erro de quem
    // chamou — o `body-parser` marca com `status` 413.
    if (typeof erro === 'object' && erro !== null && 'status' in erro && erro.status === 413) {
      res.status(413).json({ erro: 'O arquivo é grande demais.' })
      return
    }

    // JSON malformado no corpo é erro de quem chamou, não do servidor.
    if (erro instanceof SyntaxError && 'status' in erro && erro.status === 400) {
      res.status(400).json({ erro: 'Corpo da requisição inválido.' })
      return
    }

    // O mesmo `x-request-id` da linha de registro: liga o defeito à requisição.
    console.error(`Erro não tratado numa rota (${String(res.getHeader('x-request-id'))}):`, erro)
    res.status(500).json({ erro: 'Erro inesperado no servidor. Tente de novo em instantes.' })
  })

  return app
}
