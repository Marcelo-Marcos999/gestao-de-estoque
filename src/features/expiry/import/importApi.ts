import { apiFetch } from '@/shared/lib/http'
import type { ExpiryImportPlan } from './plan'

export interface ExpiryImportResult {
  created: number
  /** Já existiam (ou o produto não é da conta): o servidor pula sem erro. */
  ignored: number
}

/** O que o servidor aceita por chamada em `POST /validades/lote`. */
const BATCH = 500

/**
 * Grava os lotes novos do plano, em lotes de 500, devolvendo o controle ao
 * navegador entre eles para a barra de progresso andar numa planilha de
 * milhares de linhas. Reaplicar o mesmo plano é seguro: o servidor ignora o que
 * já existe, então uma falha no meio se resolve tentando de novo.
 */
export async function importExpiryLots(
  plan: ExpiryImportPlan,
  onProgress: (done: number, total: number) => void,
): Promise<ExpiryImportResult> {
  const lots = plan.rows
    .filter((row) => row.status === 'novo')
    .map((row) => ({ produtoId: row.productId, dataValidade: row.expiryDate }))

  let created = 0
  let ignored = 0

  for (let i = 0; i < lots.length; i += BATCH) {
    const result = await apiFetch<{ criados: number; ignorados: number }>('/validades/lote', {
      method: 'POST',
      body: { itens: lots.slice(i, i + BATCH) },
    })
    created += result.criados
    ignored += result.ignorados

    onProgress(Math.min(i + BATCH, lots.length), lots.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return { created, ignored }
}
