import { useMemo } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import { Select } from '@/shared/ui/Select'
import type { SheetData } from '@/shared/lib/spreadsheet'
import { STOCK_FIELDS, type ColumnMapping, type StockField } from '../../import/columns'
import styles from './MappingStep.module.css'

interface MappingStepProps {
  sheet: SheetData
  mapping: ColumnMapping
  /** Mensagem de por que falta escolher uma coluna, ou `null` quando o mapeamento basta. */
  mappingProblem: string | null
  onChange: (field: StockField, column: number) => void
  sampleOf: (column: number) => string
}

/**
 * A detecção automática é um palpite bem informado, não uma decisão final:
 * esta etapa existe para o usuário conferir e corrigir antes de qualquer
 * gravação. Nenhum campo é obrigatório sozinho: é preciso SKU **ou** código de
 * barras para achar o produto, e os números podem faltar numa planilha que só
 * traz parte deles (ver docs/dominio.md).
 */
export function MappingStep({
  sheet,
  mapping,
  mappingProblem,
  onChange,
  sampleOf,
}: MappingStepProps) {
  const options = useMemo(
    () => [
      { value: '-1', label: 'Não importar' },
      ...sheet.headers.map((header, index) => ({
        value: String(index),
        label: header || `Coluna ${index + 1}`,
      })),
    ],
    [sheet.headers],
  )

  return (
    <div className={styles.mapping}>
      <Alert tone="info">
        Reconhecemos as colunas pelo cabeçalho da planilha. Confira antes de continuar —{' '}
        {sheet.rows.length.toLocaleString('pt-BR')} linhas encontradas na aba{' '}
        <strong>{sheet.sheetName}</strong>.
      </Alert>

      {STOCK_FIELDS.map((spec) => (
        <div className={styles.field} key={spec.field}>
          <div className={styles.head}>
            <span className={styles.label}>{spec.label}</span>
            {spec.required ? (
              <Badge tone="marca">obrigatório</Badge>
            ) : (
              <Badge tone="neutro">opcional</Badge>
            )}
          </div>

          <p className={styles.hint}>{spec.hint}</p>

          <Select
            label={`Coluna para ${spec.label}`}
            hiddenLabel
            value={String(mapping[spec.field])}
            options={options}
            onChange={(event) => onChange(spec.field, Number(event.target.value))}
          />

          {mapping[spec.field] >= 0 && (
            <p className={styles.sample}>exemplo: {sampleOf(mapping[spec.field])}</p>
          )}
        </div>
      ))}

      {mappingProblem && <Alert tone="danger">{mappingProblem}</Alert>}
    </div>
  )
}
