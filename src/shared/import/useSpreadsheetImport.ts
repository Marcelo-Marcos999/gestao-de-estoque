import { useCallback, useMemo, useState } from 'react'
import { cellToText } from '@/shared/lib/cell'
import { readSpreadsheet, SpreadsheetError, type SheetData } from '@/shared/lib/spreadsheet'
import { detectMapping, type ColumnMapping, type FieldSpec } from './fields'

export type ImportStep = 'arquivo' | 'mapeamento' | 'revisao' | 'aplicando' | 'resumo'

export interface ImportProgress {
  done: number
  total: number
}

/**
 * O que muda de uma importação para outra. Tem de ser um objeto **estável**
 * (definido fora do componente): o assistente o usa dentro de callbacks, e um
 * objeto novo a cada render refaria todos eles.
 *
 * - `F`: nomes dos campos da planilha. `O`: escolhas do usuário na revisão
 *   (ex.: "origem padrão"). `P`: o plano. `R`: o resultado.
 */
export interface ImportConfig<F extends string, O, P, R> {
  fields: FieldSpec<F>[]
  initialOptions: O
  /** Avisos de mapeamento além dos campos obrigatórios (ex.: "SKU ou código de barras"). */
  checkMapping?: (mapping: ColumnMapping<F>) => string | null
  /** Monta o plano ANTES de gravar qualquer coisa: com milhares de linhas, descobrir depois é tarde. */
  buildPlan: (sheet: SheetData, mapping: ColumnMapping<F>, options: O) => Promise<P>
  apply: (plan: P, onProgress: (done: number, total: number) => void) => Promise<R>
  /** Quanto o plano vai gravar — decide se o botão de importar está liberado. */
  applicableCount: (plan: P) => number
  failureMessage: string
}

/**
 * Máquina de estados de uma importação por planilha: arquivo → colunas →
 * revisão → gravação → resumo. Toda a lógica de cada importação (quais colunas,
 * como classificar as linhas, como gravar) fica na `config`; aqui só a
 * sequência, que é igual para todas.
 */
export function useSpreadsheetImport<F extends string, O, P, R>(
  config: ImportConfig<F, O, P, R>,
  onImported: () => void,
) {
  const [step, setStep] = useState<ImportStep>('arquivo')
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState<SheetData | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping<F> | null>(null)
  const [options, setOptions] = useState<O>(config.initialOptions)
  const [plan, setPlan] = useState<P | null>(null)
  const [result, setResult] = useState<R | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress>({ done: 0, total: 0 })

  const reset = useCallback(() => {
    setStep('arquivo')
    setFileName('')
    setSheet(null)
    setMapping(null)
    setOptions(config.initialOptions)
    setPlan(null)
    setResult(null)
    setError(null)
    setBusy(false)
    setProgress({ done: 0, total: 0 })
  }, [config])

  const selectFile = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      setFileName(file.name)

      try {
        const data = await readSpreadsheet(file)
        if (!data.rows.length) {
          setError('A planilha tem cabeçalho, mas nenhuma linha de dados.')
        } else {
          setSheet(data)
          setMapping(detectMapping(data.headers, config.fields))
          setStep('mapeamento')
        }
      } catch (err) {
        setError(
          err instanceof SpreadsheetError
            ? err.message
            : 'Não foi possível ler o arquivo. Confira se ele não está aberto no Excel e tente de novo.',
        )
      }

      setBusy(false)
    },
    [config],
  )

  const setFieldColumn = useCallback((field: F, column: number) => {
    setMapping((current) => (current ? { ...current, [field]: column } : current))
  }, [])

  const missing = useMemo(() => {
    if (!mapping) return []
    const required = config.fields.filter((f) => f.required && mapping[f.field] === -1)
    const messages = required.map((f) => f.label)
    const extra = config.checkMapping?.(mapping)
    return extra ? [...messages, extra] : messages
  }, [mapping, config])

  const review = useCallback(
    async (nextOptions: O = options) => {
      if (!sheet || !mapping) return

      setBusy(true)
      setError(null)
      try {
        setPlan(await config.buildPlan(sheet, mapping, nextOptions))
        setStep('revisao')
      } catch {
        setError('Não foi possível conferir a planilha agora. Tente de novo.')
      }
      setBusy(false)
    },
    [sheet, mapping, options, config],
  )

  /** Uma escolha da revisão (ex.: origem padrão) muda o plano: reclassifica as linhas. */
  const changeOptions = useCallback(
    async (patch: Partial<O>) => {
      const next = { ...options, ...patch }
      setOptions(next)
      await review(next)
    },
    [options, review],
  )

  const apply = useCallback(async () => {
    if (!plan) return

    setError(null)
    setStep('aplicando')
    setProgress({ done: 0, total: config.applicableCount(plan) })

    try {
      setResult(await config.apply(plan, (done, total) => setProgress({ done, total })))
      setStep('resumo')
      onImported()
    } catch {
      // Sem isto a tela ficava parada em "0 de N" para sempre. Voltar para a
      // revisão deixa tentar de novo.
      setError(config.failureMessage)
      setStep('revisao')

      // O plano antigo ainda lista o que uma falha no meio já gravou, e
      // reaplicá-lo duplicaria. Reconferir contra o que existe agora faz esses
      // registros aparecerem como "já existem" e saírem do que vai ser enviado.
      if (sheet && mapping) {
        try {
          setPlan(await config.buildPlan(sheet, mapping, options))
        } catch {
          // Sem conexão: fica o plano antigo, e o aviso acima já diz para conferir.
        }
      }
    }
  }, [plan, config, onImported, sheet, mapping, options])

  /** Primeiro valor não vazio de uma coluna, para conferir o mapeamento. */
  const sampleOf = useCallback(
    (column: number): string => {
      if (!sheet || column < 0) return ''
      for (const row of sheet.rows.slice(0, 20)) {
        const text = cellToText(row[column])
        if (text) return text
      }
      return '(vazio nas primeiras linhas)'
    },
    [sheet],
  )

  return {
    config,
    step,
    setStep,
    fileName,
    sheet,
    mapping,
    options,
    plan,
    result,
    error,
    busy,
    progress,
    missing,
    reset,
    selectFile,
    setFieldColumn,
    review,
    changeOptions,
    apply,
    sampleOf,
  }
}

export type SpreadsheetImport<F extends string, O, P, R> = ReturnType<
  typeof useSpreadsheetImport<F, O, P, R>
>
