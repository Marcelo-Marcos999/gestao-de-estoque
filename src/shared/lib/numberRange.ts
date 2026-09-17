/**
 * Filtro de intervalo numérico: mínimo e/ou máximo, cada um opcional.
 *
 * Vive em `shared/` porque quatro telas usam o mesmo formato para colunas
 * diferentes (saldo, saídas, custo, venda, quantidade...) — a lógica de
 * comparar e descrever um intervalo é sempre a mesma, só a coluna muda.
 */
export interface NumberRange {
  min: number | null
  max: number | null
}

export const EMPTY_RANGE: NumberRange = { min: null, max: null }

export function isRangeActive(range: NumberRange | undefined): boolean {
  return !!range && (range.min !== null || range.max !== null)
}

export function matchesRange(value: number, range: NumberRange | undefined): boolean {
  if (!range) return true
  if (range.min !== null && value < range.min) return false
  if (range.max !== null && value > range.max) return false
  return true
}

export function countActiveRanges(ranges: Record<string, NumberRange>): number {
  return Object.values(ranges).filter(isRangeActive).length
}

/** Texto estável para compor a chave de uma busca — dispara refetch quando muda. */
export function rangesKey(ranges: Record<string, NumberRange>): string {
  return Object.entries(ranges)
    .map(([key, range]) => `${key}:${range.min ?? ''}-${range.max ?? ''}`)
    .join('|')
}

function isNumberRange(value: unknown): value is NumberRange {
  if (typeof value !== 'object' || value === null) return false
  const { min, max } = value as Record<string, unknown>
  return (min === null || typeof min === 'number') && (max === null || typeof max === 'number')
}

/** Confere que todo campo esperado veio como um intervalo válido — usado para não deixar um registro persistido fora de formato quebrar a tela. */
export function isRangesRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, NumberRange> {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return keys.every((key) => isNumberRange(obj[key]))
}

/** Frase pronta para o aviso de filtro ativo: "Saldo entre 10 e 50", "Saldo até 50"... */
export function describeRange(label: string, range: NumberRange | undefined): string | null {
  if (!isRangeActive(range)) return null
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  if (range!.min !== null && range!.max !== null) {
    return `${label} entre ${fmt(range!.min)} e ${fmt(range!.max)}`
  }
  if (range!.min !== null) return `${label} a partir de ${fmt(range!.min)}`
  return `${label} até ${fmt(range!.max as number)}`
}
