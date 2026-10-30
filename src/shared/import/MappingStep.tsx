import { useMemo } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import { Select } from '@/shared/ui/Select'
import type { SheetData } from '@/shared/lib/spreadsheet'
import type { ColumnMapping, FieldSpec } from './fields'
import styles from './MappingStep.module.css'

interface MappingStepProps<F extends string> {
  sheet: SheetData
  fields: FieldSpec<F>[]
  mapping: ColumnMapping<F>
  missing: string[]
  onChange: (field: F, column: number) => void
  sampleOf: (column: number) => string
}

/**
 * A detecção automática é um palpite, não uma decisão: esta etapa existe para
 * a pessoa conferir e corrigir antes de qualquer gravação.
 */
export function MappingStep<F extends string>({
  sheet,
  fields,
  mapping,
  missing,
  onChange,
  sampleOf,
}: MappingStepProps<F>) {
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

      {fields.map((spec) => (
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

      {missing.length > 0 && (
        <Alert tone="danger">Falta escolher: {missing.join('; ')}.</Alert>
      )}
    </div>
  )
}
