import type { FieldSpec } from '@/shared/import/fields'

export type ExpiryImportField = 'sku' | 'barcode' | 'expiryDate'

/**
 * Colunas da planilha de validades. Um lote é produto **mais** validade, então
 * a planilha precisa dizer qual é o produto (SKU ou código de barras, um dos
 * dois) e a data. Saldo, saídas e custo não vêm daqui: são do estoque.
 */
export const EXPIRY_IMPORT_FIELDS: FieldSpec<ExpiryImportField>[] = [
  {
    field: 'sku',
    label: 'Código SKU',
    required: false,
    hint: 'O mesmo código do cadastro de produtos. Use este ou o código de barras.',
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
    field: 'expiryDate',
    label: 'Validade',
    required: true,
    hint: 'Data de validade do lote, como dd/mm/aaaa.',
    patterns: ['datadevalidade', 'datavalidade', 'validade', 'vencimento', 'datavencimento', 'venc'],
  },
]
