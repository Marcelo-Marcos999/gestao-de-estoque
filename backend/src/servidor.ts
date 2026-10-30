import 'dotenv/config'
import { criarApp } from './app.js'

const porta = Number(process.env.PORT ?? 3000)

const app = criarApp()

app.listen(porta, () => {
  console.log(`Backend ouvindo na porta ${porta}`)
})
