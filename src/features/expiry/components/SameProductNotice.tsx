import { Alert } from '@/shared/ui/Alert'
import { formatDate, type IsoDate } from '@/shared/lib/date'
import type { ExpiryItem } from '../types'

/** Datas demais viram uma lista que ninguém lê: mostra algumas e diz quantas faltam. */
const SHOWN = 4

interface SameProductNoticeProps {
  /** Lotes que a loja já acompanha do produto escolhido. */
  existing: ExpiryItem[]
  /** A validade que a pessoa está digitando, para dizer quando ela já existe. */
  chosenDate: IsoDate | null
}

/**
 * Avisa que o produto já tem lote em acompanhamento. **Só informa**: ter outro
 * lote do mesmo produto é normal (a próxima caixa vence em outra data), e quem
 * decide é quem está com a mercadoria na mão.
 *
 * O único caso que não cria nada novo é a MESMA data: lote é produto mais
 * validade, então repeti-la seria o mesmo lote. O aviso diz isso na hora, em vez
 * de a pessoa descobrir ao salvar.
 */
export function SameProductNotice({ existing, chosenDate }: SameProductNoticeProps) {
  if (existing.length === 0) return null

  const dates = existing
    .map((item) => item.expiryDate)
    .sort((a, b) => (a ?? '9999').localeCompare(b ?? '9999'))
  const shown = dates.slice(0, SHOWN).map((date) => (date ? formatDate(date) : 'sem data'))
  const rest = dates.length - SHOWN
  const sameDate = chosenDate !== null && dates.includes(chosenDate)

  return (
    <Alert tone="info">
      Este produto já tem {existing.length === 1 ? '1 lote' : `${existing.length} lotes`} em
      acompanhamento nesta loja: {shown.join(', ')}
      {rest > 0 && ` e mais ${rest}`}.{' '}
      {sameDate
        ? 'Essa validade já está na lista: ela continua um lote só, não é duplicada.'
        : 'Pode acompanhar outro lote mesmo assim.'}
    </Alert>
  )
}
