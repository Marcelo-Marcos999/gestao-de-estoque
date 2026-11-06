import { poolAuth } from '../db/poolAuth.js'
import { apagarArquivo, armazenamentoLigado } from './armazenamento.js'

/** Quantos arquivos o bucket apaga ao mesmo tempo: rápido sem abrir centenas de conexões. */
const SIMULTANEOS = 8

export class ArmazenamentoIndisponivel extends Error {}

/**
 * Apaga uma empresa por completo: todos os registros no banco e todos os arquivos
 * (fotos e PDFs dos anexos) no R2. Sem volta.
 *
 * O banco e o bucket são dois sistemas, e não existe transação que cubra os dois.
 * A ordem escolhida é a que não deixa lixo nem perde dado por acidente:
 *
 *   1. abre a transação e chama `excluir_conta`, que apaga as linhas e devolve os
 *      caminhos dos arquivos — mas AINDA NÃO confirma;
 *   2. apaga os arquivos no bucket;
 *   3. só então confirma. Se algum arquivo falhar, desfaz tudo (a empresa continua
 *      inteira) e a pessoa tenta de novo; apagar o que já foi apagado não é erro.
 *
 * Enquanto a transação está aberta as linhas ficam travadas: um anexo enviado
 * nesse intervalo por quem ainda está logado não consegue entrar (a quebra dele
 * está sendo apagada), então nenhum arquivo nasce sem registro e fica órfão.
 *
 * Usa `poolAuth`: a função de exclusão só é liberada para a role `app_auth`, não
 * para a que atende as telas dos clientes (ver a migração 0009).
 */
export async function excluirContaCompleta(contaId: string): Promise<{ arquivosApagados: number }> {
  const client = await poolAuth.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ excluir_conta: string }>('select excluir_conta($1)', [contaId])
    const caminhos = rows.map((linha) => linha.excluir_conta)

    // Existir anexo com o armazenamento desligado só acontece se alguém tirou as
    // variáveis depois de usar. Apagar as linhas deixaria os arquivos órfãos no
    // bucket sem ninguém saber o caminho: melhor recusar.
    if (caminhos.length > 0 && !armazenamentoLigado()) {
      throw new ArmazenamentoIndisponivel('Armazenamento de arquivos desligado.')
    }

    await apagarEmLotes(caminhos)
    await client.query('COMMIT')
    return { arquivosApagados: caminhos.length }
  } catch (erro) {
    await client.query('ROLLBACK').catch(() => {})
    throw erro
  } finally {
    client.release()
  }
}

async function apagarEmLotes(caminhos: string[]): Promise<void> {
  for (let i = 0; i < caminhos.length; i += SIMULTANEOS) {
    await Promise.all(caminhos.slice(i, i + SIMULTANEOS).map((caminho) => apagarArquivo(caminho)))
  }
}

/**
 * Confirmação forte: a pessoa digita o nome da empresa. Espaços sobrando nas
 * pontas e no meio não contam (quem copia o nome da tela leva junto um espaço), mas
 * maiúsculas e acentos sim — é o que impede de apagar uma empresa por reflexo.
 */
export function confirmacaoConfere(digitado: string, nomeDaEmpresa: string): boolean {
  const normalizar = (texto: string) => texto.trim().replace(/\s+/g, ' ')
  return normalizar(digitado) === normalizar(nomeDaEmpresa)
}
