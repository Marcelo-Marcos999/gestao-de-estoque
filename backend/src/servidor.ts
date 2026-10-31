import 'dotenv/config'
import { criarApp } from './app.js'
import { armazenamentoLigado, variaveisFaltando } from './lib/armazenamento.js'

const porta = Number(process.env.PORT ?? 3000)

const app = criarApp()

app.listen(porta, () => {
  console.log(`Backend ouvindo na porta ${porta}`)
  // Diz no log se os anexos estão ligados e, se não, o que falta — só os nomes das
  // variáveis, nunca os valores. Evita adivinhar pelo painel do Render.
  console.log(
    armazenamentoLigado()
      ? 'Armazenamento de anexos: ligado.'
      : `Armazenamento de anexos: DESLIGADO (faltam: ${variaveisFaltando().join(', ')}).`,
  )
})
