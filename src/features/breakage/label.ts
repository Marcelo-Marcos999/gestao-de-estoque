import type { LossRecord } from './types'

/**
 * Como o registro se chama na tela.
 *
 * Produto pendente entra sem descrição e sem SKU — só com o código de barras
 * lido. Sem esta escada, o desfazer chegava a dizer "Registro de excluído",
 * uma frase truncada que não identifica nada.
 */
export function recordLabel(record: LossRecord): string {
  return record.description.trim() || record.sku || record.barcode || 'produto sem identificação'
}

/**
 * Quem aparece como dono do registro. Com várias lojas à vista (administrador),
 * a loja vem na frente — é ela que o administrador precisa distinguir — e o
 * autor só quando for outra pessoa (o administrador registrando por uma loja).
 */
export function ownerLabel(record: LossRecord, showStore: boolean): string {
  if (!showStore) return record.createdBy
  return record.createdBy === record.storeName
    ? record.storeName
    : `${record.storeName} (por ${record.createdBy})`
}
