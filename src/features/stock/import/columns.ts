/**
 * Reconhecimento das colunas da planilha de estoque.
 *
 * Mesma ideia do cadastro de produtos: casa pelo cabeçalho, porque o relatório
 * do ERP varia de nome ("SALDO", "estoque_atual", "QTD ESTOQUE"). Diferente do
 * cadastro, só o SKU é obrigatório — a loja pode trazer só saldo e saídas numa
 * planilha e completar custo e venda depois, numa segunda (ver
 * docs/dominio.md, "três fontes").
 */
export type StockField = 'sku' | 'stock' | 'outflow' | 'costPrice' | 'salePrice'

export interface FieldSpec {
  field: StockField
  label: string
  required: boolean
  hint: string
}

export const STOCK_FIELDS: FieldSpec[] = [
  {
    field: 'sku',
    label: 'Código SKU',
    required: true,
    hint: 'O mesmo código do cadastro de produtos — é por ele que a linha casa com o produto.',
  },
  {
    field: 'stock',
    label: 'Saldo em estoque',
    required: false,
    hint: 'Quantidade atual na loja.',
  },
  {
    field: 'outflow',
    label: 'Saídas no período',
    required: false,
    hint: 'Quantidade vendida no período configurado nas Validades.',
  },
  {
    field: 'costPrice',
    label: 'Valor de custo',
    required: false,
    hint: 'Custo unitário do produto.',
  },
  {
    field: 'salePrice',
    label: 'Valor de venda',
    required: false,
    hint: 'Preço de venda unitário.',
  },
]

export type ColumnMapping = Record<StockField, number>

export const EMPTY_MAPPING: ColumnMapping = {
  sku: -1,
  stock: -1,
  outflow: -1,
  costPrice: -1,
  salePrice: -1,
}

/** Remove acento, pontuação e caixa para comparar cabeçalhos. */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const HEADER_PATTERNS: Record<StockField, string[]> = {
  // Ordem importa: o primeiro que casar vence, então termos mais específicos
  // vêm antes dos genéricos — "saldo em estoque" não pode cair em "estoque".
  sku: ['codigosku', 'sku', 'codproduto', 'codigoproduto', 'codigo', 'cod', 'id'],
  stock: ['saldoemestoque', 'saldo', 'qtdestoque', 'quantidadeestoque', 'estoqueatual', 'estoque'],
  outflow: ['saidasnoperiodo', 'saidas', 'qtdsaida', 'quantidadesaida', 'vendas', 'saida'],
  costPrice: ['valordecusto', 'valorcusto', 'precocusto', 'custounitario', 'custo'],
  salePrice: ['valordevenda', 'valorvenda', 'precovenda', 'precodevenda', 'venda'],
}

function matchByHeader(headers: string[], field: StockField, taken: Set<number>): number {
  const normalized = headers.map(normalizeHeader)

  for (const pass of ['exact', 'partial'] as const) {
    for (const pattern of HEADER_PATTERNS[field]) {
      for (let i = 0; i < normalized.length; i++) {
        if (taken.has(i) || !normalized[i]) continue

        const hit =
          pass === 'exact' ? normalized[i] === pattern : normalized[i].includes(pattern)

        if (hit) return i
      }
    }
  }

  return -1
}

/**
 * Monta o mapeamento inicial. Diferente do cadastro, aqui não há conteúdo que
 * ajude a adivinhar uma coluna numérica sem nome — só o cabeçalho decide. O
 * usuário sempre pode corrigir antes de importar; a detecção é um palpite bem
 * informado, não uma decisão final.
 */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING }
  const taken = new Set<number>()

  // Ordem pensada para o termo mais específico reservar a coluna primeiro:
  // "saldo" antes de deixar sobrar ambiguidade com outros campos numéricos.
  for (const field of ['sku', 'stock', 'outflow', 'costPrice', 'salePrice'] as const) {
    const index = matchByHeader(headers, field, taken)
    if (index >= 0) {
      mapping[field] = index
      taken.add(index)
    }
  }

  return mapping
}
