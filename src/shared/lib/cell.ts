import type { CellValue } from './spreadsheet'

/**
 * Converte uma célula em texto sem corromper códigos.
 *
 * Planilha entrega código de barras ora como texto, ora como número. Passar um
 * número por String() perde a formatação em valores muito grandes (vira
 * notação científica) e, acima de 2^53, dígitos já se perderam antes de chegar
 * aqui. Por isso números não inteiros ou fora da faixa segura são recusados,
 * em vez de gerar um código silenciosamente errado.
 */
export function cellToText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'boolean') return value ? 'sim' : 'não'

  if (!Number.isFinite(value)) return ''
  if (Number.isInteger(value)) {
    // Fora da faixa segura o valor já chegou arredondado: melhor recusar do
    // que gravar um código de barras parecido com o certo, mas errado.
    if (!Number.isSafeInteger(value)) return ''
    return value.toFixed(0)
  }

  return String(value)
}

/** Mantém só dígitos — código de barras e SKU não têm espaço nem pontuação. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Converte uma célula em número, aceitando o formato brasileiro (vírgula
 * decimal, ponto de milhar) além do número já nativo da planilha.
 *
 * `null` quer dizer "esta célula não descreve um número" — quem chama decide
 * se isso é vazio (mantém o valor atual) ou linha inválida, conforme o campo.
 */
export function cellToNumber(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const texto = value.trim()
  if (!texto) return null

  // Havendo vírgula, ela é o separador decimal e qualquer ponto é milhar
  // ("1.234,56"); sem vírgula, o ponto já é decimal ("1234.56"). Decidir pela
  // presença da vírgula evita ler "1.234" (mil duzentos e trinta e quatro) como
  // "1,234" (um vírgula dois três quatro).
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto

  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}
