import type { ChosenProduct } from '@/features/products'
import type { IsoDate } from '@/shared/lib/date'
import { EMPTY_RANGE, type NumberRange } from '@/shared/lib/numberRange'

/**
 * Etiqueta escolhida pelo usuário. Dois eixos separados usam a mesma forma:
 * o **motivo** (por que virou perda) e a **origem** (de onde veio o problema).
 *
 * Juntar os dois numa lista só faria as opções crescerem por combinação
 * — "danificado", "danificado do CD", "vencido do CD" — e os relatórios
 * deixariam de separar "quanto perdemos por avaria" de "quanto disso veio do
 * CD" (ver docs/dominio.md).
 */
export interface Tag {
  id: string
  label: string
  /** Marca as etiquetas que já vêm com o sistema, para não sumirem sem querer. */
  builtIn: boolean
}

export type AttachmentKind = 'foto-produto' | 'foto-etiqueta' | 'documento'

export interface Attachment {
  id: string
  kind: AttachmentKind
  fileName: string
  /** Para o visualizador saber se mostra a imagem ou só oferece o download. */
  mimeType: string
  /** Em bytes, para avisar o tamanho antes de alguém baixar no 4G da loja. */
  size: number
}

/**
 * Uma ocorrência de perda.
 *
 * Identidade: produto + validade + motivo. A validade é o que distingue de
 * verdade — dois lotes do mesmo produto com datas diferentes são coisas
 * diferentes. A origem é atributo obrigatório, mas não parte da identidade.
 */
export interface LossRecord {
  id: string
  /** Vazio enquanto o produto não existe no cadastro. */
  productId: string
  /** Copiados no momento do registro: o produto pendente ainda não tem cadastro. */
  sku: string
  description: string
  barcode: string
  /** True enquanto o administrador não completar o cadastro. */
  pendingProduct: boolean
  expiryDate: IsoDate | null
  quantity: number
  reasonId: string
  /** Obrigatória, como o motivo: é o que separa "quanto perdemos" de "de onde veio". */
  originId: string
  note: string
  attachments: Attachment[]
  /**
   * Custo unitário do produto no estoque da loja, lido na hora: a quebra não
   * guarda cópia, porque dois números de custo para o mesmo produto numa
   * mesma tela é exatamente o que se quer evitar. `null` para produto
   * pendente de cadastro, que ainda não tem estoque.
   */
  costPrice: number | null
  /** Quantidade × custo: quanto a perda custou. Calculado, nunca guardado. */
  totalCost: number | null
  createdAt: string
  /** Nome de quem registrou. */
  createdBy: string
  /** Login de quem registrou: o "desfazer" devolve o registro ao mesmo autor. */
  createdById: string
}

/** O que o formulário coleta; o resto é responsabilidade do sistema. */
export interface LossRecordDraft {
  productId: string
  sku: string
  description: string
  barcode: string
  pendingProduct: boolean
  expiryDate: IsoDate | null
  quantity: number
  reasonId: string
  originId: string
  note: string
  attachments: Attachment[]
}

export type LossRecordRangeKey = 'quantity' | 'costPrice' | 'totalCost'

export const LOSS_RECORD_RANGE_FIELDS: { key: LossRecordRangeKey; label: string }[] = [
  { key: 'quantity', label: 'Quantidade' },
  { key: 'costPrice', label: 'Custo' },
  { key: 'totalCost', label: 'Total custo' },
]

export const EMPTY_LOSS_RECORD_RANGES: Record<LossRecordRangeKey, NumberRange> = Object.fromEntries(
  LOSS_RECORD_RANGE_FIELDS.map((field) => [field.key, EMPTY_RANGE]),
) as Record<LossRecordRangeKey, NumberRange>

export interface LossRecordQuery {
  search: string
  /** 'no-estoque' esconde os que zeraram; 'zerados' mostra só eles. */
  stockState: 'todos' | 'no-estoque' | 'zerados'
  /** Vazio mostra todos os motivos. Vários marcados somam (ou), não filtram em série (e). */
  reasonIds: string[]
  /** Vazio mostra todas as origens. */
  originIds: string[]
  /** Um intervalo por número do registro, do painel "Filtro" (ver docs/dominio.md). */
  numberRanges: Record<LossRecordRangeKey, NumberRange>
}

/**
 * Ponto de partida de um registro novo quando quem abre o formulário já sabe
 * o produto e a validade — como a tela de Validades, ao gerar a quebra de um
 * lote vencido. Diferente de `editing`: aqui não existe registro gravado
 * ainda, só um rascunho pronto para revisão antes de salvar.
 */
export interface LossRecordInitialDraft {
  product: ChosenProduct
  expiryDate: IsoDate | null
  quantity: number
  /**
   * Nome do motivo a pré-selecionar, quando ele ainda existir na lista — ela
   * é editável, então "Vencido" pode ter sido renomeado ou excluído (ver
   * docs/dominio.md). Sem casamento, o formulário abre sem motivo escolhido,
   * em vez de gravar um id que não aponta para etiqueta nenhuma.
   */
  reasonLabel?: string
}
