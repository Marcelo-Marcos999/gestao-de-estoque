import { daysUntil } from '@/shared/lib/date'
import type { LossRecord } from './types'

/** Token de cor e texto do prazo de validade de um registro. */
export interface Deadline {
  token: 'expired' | 'warning' | 'ok' | 'unknown'
  text: string
}

/**
 * Prazo do lote, em cor e texto.
 *
 * Vive fora dos componentes porque a linha e o cartão mostram o mesmo prazo —
 * duas cópias da regra dariam duas respostas no dia em que uma mudasse.
 *
 * A cor nunca vem sozinha: o texto diz "venceu há 4 dias" mesmo para quem não
 * enxerga a diferença entre vermelho e âmbar (ver CLAUDE.md).
 */
export function deadline(record: LossRecord, short = false): Deadline {
  if (!record.expiryDate) return { token: 'unknown', text: 'sem validade' }

  const restantes = daysUntil(record.expiryDate)
  if (restantes === null) return { token: 'unknown', text: 'sem validade' }

  // A forma curta existe para o cartão do celular, onde o chip divide a linha
  // com o motivo: "vence em 18 dias" ao lado de "Avaria de transporte" não
  // cabe em 360px, e a quebra empurrava cada etiqueta para uma linha própria.
  // O ícone de calendário ao lado já diz que o número é de validade.
  if (restantes < 0) {
    return { token: 'expired', text: short ? `há ${Math.abs(restantes)}d` : `venceu há ${Math.abs(restantes)} dias` }
  }
  if (restantes === 0) return { token: 'warning', text: 'vence hoje' }

  return {
    token: restantes <= 30 ? 'warning' : 'ok',
    text: short ? `em ${restantes}d` : `vence em ${restantes} dias`,
  }
}
