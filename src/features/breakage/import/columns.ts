import type { FieldSpec } from '@/shared/import/fields'

export type BreakageImportField =
  | 'sku'
  | 'barcode'
  | 'description'
  | 'expiryDate'
  | 'quantity'
  | 'reason'
  | 'origin'
  | 'note'

/**
 * Colunas da planilha de quebra, pensadas para uma base que já existia antes
 * deste sistema: o que se sabe do produto, a validade, quanto foi perdido e a
 * classificação. Só a quantidade é obrigatória — o produto se acha por SKU ou
 * código de barras, e o que não tiver classificação recebe a que a pessoa
 * escolher na revisão.
 */
export const BREAKAGE_IMPORT_FIELDS: FieldSpec<BreakageImportField>[] = [
  {
    field: 'sku',
    label: 'Código SKU',
    required: false,
    hint: 'Casa a linha com o produto do cadastro. Use este ou o código de barras.',
    patterns: ['codigosku', 'sku', 'codproduto', 'codigoproduto'],
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
    field: 'description',
    label: 'Descrição do produto',
    required: false,
    hint: 'Só vale para produto fora do cadastro, que entra como pendente com este nome.',
    patterns: ['descricaodoproduto', 'descricao', 'descproduto', 'produto', 'nome'],
  },
  {
    field: 'expiryDate',
    label: 'Validade',
    required: false,
    hint: 'Data de validade do lote que quebrou, como dd/mm/aaaa.',
    patterns: ['datadevalidade', 'datavalidade', 'validade', 'vencimento', 'datavencimento', 'venc'],
  },
  {
    field: 'quantity',
    label: 'Quantidade',
    required: true,
    hint: 'Quanto foi perdido, em unidades.',
    patterns: ['quantidadequebrada', 'quantidade', 'qtdquebra', 'qtde', 'qtd'],
  },
  {
    field: 'reason',
    label: 'Motivo',
    required: false,
    hint: 'Por que virou perda. Motivo novo na planilha é criado na lista; linha sem motivo usa o que você escolher na revisão.',
    patterns: ['motivodaquebra', 'motivoquebra', 'motivo'],
  },
  {
    field: 'origin',
    label: 'Origem',
    required: false,
    hint: 'De onde veio o problema. Origem nova na planilha é criada na lista; linha sem origem usa a que você escolher na revisão.',
    patterns: ['origemdoproblema', 'origem'],
  },
  {
    field: 'note',
    label: 'Observação',
    required: false,
    hint: 'Texto livre, guardado junto do registro.',
    patterns: ['observacoes', 'observacao', 'obs', 'comentario'],
  },
]
