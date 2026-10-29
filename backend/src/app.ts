import cors from 'cors'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import { rotasAuth } from './rotas/auth.js'
import { rotasEstoque } from './rotas/estoque.js'
import { rotasProdutos } from './rotas/produtos.js'

export function criarApp() {
  const app = express()

  // Cabeçalhos de segurança padrão (HSTS, no-sniff, etc.) — sem isso o
  // Express não manda nenhum.
  app.use(helmet())

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
  app.use('/produtos', rotasProdutos)
  app.use('/estoque', rotasEstoque)

  // Último `app.use`, com 4 parâmetros — é assim que o Express reconhece um
  // middleware de ERRO em vez de uma rota normal. Toda rota é envolvida com
  // `assincrono()` (ver lib/assincrono.ts), que entrega qualquer rejeição
  // aqui em vez de deixar o processo inteiro cair — quem chega até aqui
  // nunca viu a causa real do erro, só um 500 genérico; os detalhes vão pro
  // log do servidor, não pra resposta.
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Erro não tratado numa rota:', erro)
    res.status(500).json({ erro: 'Erro inesperado no servidor. Tente de novo em instantes.' })
  })

  return app
}
