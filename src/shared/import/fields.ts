/**
 * Reconhecimento das colunas de uma planilha, para qualquer importação.
 *
 * Casa pelo cabeçalho, porque o relatório do ERP varia de nome ("SALDO",
 * "estoque_atual", "QTD ESTOQUE"). O reconhecimento é um palpite bem
 * informado, não uma decisão: a etapa seguinte sempre deixa corrigir.
 */
export interface FieldSpec<F extends string> {
  field: F
  label: string
  required: boolean
  hint: string
  /**
   * Cabeçalhos aceitos, já normalizados (`normalizeHeader`). Ordem importa: o
   * primeiro que casar vence, então os termos específicos vêm antes dos
   * genéricos — "saldo em estoque" não pode cair em "estoque".
   */
  patterns: string[]
  /**
   * Termos genéricos demais para valer por "contém": só casam com o cabeçalho
   * **inteiro**. "Código" é o cabeçalho de SKU numa planilha, mas, por conter a
   * palavra, também pegaria a coluna "Código de barras".
   */
  exactPatterns?: string[]
}

/** Índice da coluna escolhida para cada campo; -1 = não importar. */
export type ColumnMapping<F extends string> = Record<F, number>

/** Remove acento, pontuação e caixa para comparar cabeçalhos. */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function matchByHeader<F extends string>(
  headers: string[],
  spec: FieldSpec<F>,
  taken: Set<number>,
): number {
  const normalized = headers.map(normalizeHeader)

  // Primeiro o cabeçalho idêntico, depois o que apenas contém o termo: "Código
  // SKU" ganha de uma coluna "Descrição do SKU" que só contém a palavra.
  const candidates = { exact: [...spec.patterns, ...(spec.exactPatterns ?? [])], partial: spec.patterns }
  for (const pass of ['exact', 'partial'] as const) {
    for (const pattern of candidates[pass]) {
      for (let i = 0; i < normalized.length; i++) {
        if (taken.has(i) || !normalized[i]) continue
        const hit = pass === 'exact' ? normalized[i] === pattern : normalized[i].includes(pattern)
        if (hit) return i
      }
    }
  }

  return -1
}

export function emptyMapping<F extends string>(specs: FieldSpec<F>[]): ColumnMapping<F> {
  return Object.fromEntries(specs.map((spec) => [spec.field, -1])) as ColumnMapping<F>
}

/** Mapeamento inicial. Cada coluna é de um campo só: quem reserva primeiro, fica. */
export function detectMapping<F extends string>(
  headers: string[],
  specs: FieldSpec<F>[],
): ColumnMapping<F> {
  const mapping = emptyMapping(specs)
  const taken = new Set<number>()

  for (const spec of specs) {
    const index = matchByHeader(headers, spec, taken)
    if (index >= 0) {
      mapping[spec.field] = index
      taken.add(index)
    }
  }

  return mapping
}
