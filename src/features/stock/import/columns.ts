/**
 * Reconhecimento das colunas da planilha de estoque.
 *
 * Mesma ideia das outras importações: casa pelo cabeçalho, porque o relatório
 * do ERP varia de nome ("SALDO", "estoque_atual", "QTD ESTOQUE"). A linha diz
 * qual é o produto por SKU **ou** código de barras (um dos dois basta, como em
 * Validades); saldo, saídas, custo e venda são opcionais — a loja pode trazer
 * só parte numa planilha e completar o resto numa segunda (ver
 * docs/dominio.md, "três fontes").
 *
 * O casamento de cabeçalhos é o de `shared/import/fields`: aqui só se declaram
 * os campos e os nomes que cada um aceita.
 */
import {
  detectMapping as detectSharedMapping,
  emptyMapping,
  type ColumnMapping as SharedColumnMapping,
  type FieldSpec as SharedFieldSpec,
} from '@/shared/import/fields'

export type StockField = 'sku' | 'barcode' | 'stock' | 'outflow' | 'costPrice' | 'salePrice'

export type ColumnMapping = SharedColumnMapping<StockField>

/**
 * A ordem é a da tela e também a da detecção: quem vem antes reserva a coluna.
 * Dentro de cada campo, termos específicos antes dos genéricos — "saldo em
 * estoque" não pode cair em "estoque".
 */
export const STOCK_FIELDS: SharedFieldSpec<StockField>[] = [
  {
    field: 'sku',
    label: 'Código SKU',
    required: false,
    hint: 'O mesmo código do cadastro de produtos. Use este ou o código de barras.',
    patterns: ['codigosku', 'sku', 'codproduto', 'codigoproduto'],
    // "Código" sozinho é o cabeçalho de SKU numa planilha, mas por "conter" a
    // palavra também pegaria "Código de barras" — por isso só vale inteiro.
    exactPatterns: ['codigo', 'cod', 'id'],
  },
  {
    field: 'barcode',
    label: 'Código de barras',
    required: false,
    hint: 'Usado quando a linha não tem SKU, ou quando o SKU não está no cadastro.',
    patterns: ['codigodebarras', 'codbarras', 'codigobarras', 'ean', 'gtin', 'barras'],
  },
  {
    field: 'stock',
    label: 'Saldo em estoque',
    required: false,
    hint: 'Quantidade atual na loja.',
    patterns: ['saldoemestoque', 'saldo', 'qtdestoque', 'quantidadeestoque', 'estoqueatual', 'estoque'],
  },
  {
    field: 'outflow',
    label: 'Saídas no período',
    required: false,
    hint: 'Quantidade vendida no período configurado nas Validades.',
    patterns: ['saidasnoperiodo', 'saidas', 'qtdsaida', 'quantidadesaida', 'vendas', 'saida'],
  },
  {
    field: 'costPrice',
    label: 'Valor de custo',
    required: false,
    hint: 'Custo unitário do produto.',
    patterns: ['valordecusto', 'valorcusto', 'precocusto', 'custounitario', 'custo'],
  },
  {
    field: 'salePrice',
    label: 'Valor de venda',
    required: false,
    hint: 'Preço de venda unitário.',
    patterns: ['valordevenda', 'valorvenda', 'precovenda', 'precodevenda', 'venda'],
  },
]

export const EMPTY_MAPPING: ColumnMapping = emptyMapping(STOCK_FIELDS)

/**
 * Mapeamento inicial. Diferente do cadastro, aqui não há conteúdo que ajude a
 * adivinhar uma coluna numérica sem nome — só o cabeçalho decide. O usuário
 * sempre pode corrigir antes de importar; a detecção é um palpite, não uma
 * decisão final.
 */
export function detectMapping(headers: string[]): ColumnMapping {
  return detectSharedMapping(headers, STOCK_FIELDS)
}

const NOT_CHOSEN = 'Escolha a coluna de SKU ou de código de barras.'

/** Não há campo obrigatório sozinho: é preciso um jeito de achar o produto, SKU ou código de barras. */
export function checkStockMapping(mapping: ColumnMapping): string | null {
  return mapping.sku < 0 && mapping.barcode < 0 ? NOT_CHOSEN : null
}
