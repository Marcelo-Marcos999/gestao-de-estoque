import { useCallback, useMemo, useState } from 'react'
import { cellToText } from '@/shared/lib/cell'
import { readSpreadsheet, SpreadsheetError, type SheetData } from '@/shared/lib/spreadsheet'
import { bulkCreate, getAllProducts } from '../api'
import { PRODUCT_FIELDS, detectMapping, type ColumnMapping, type ProductField } from './columns'
import { buildImportPlan, draftsToImport, type ImportPlan } from './plan'

export type Step = 'arquivo' | 'mapeamento' | 'revisao' | 'aplicando' | 'resumo'

export interface Progress {
  done: number
  total: number
}

/**
 * Máquina de estados da importação, separada do desenho das etapas.
 *
 * Fica aqui tudo que decide *o que* acontece — ler o arquivo, deduzir as
 * colunas, montar o plano, gravar. Cada etapa da interface só recebe o que
 * precisa mostrar e o que pode disparar.
 */
export function useImportWizard(onImported: () => void) {
  const [step, setStep] = useState<Step>('arquivo')
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState<SheetData | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0 })
  const [imported, setImported] = useState(0)

  const reset = useCallback(() => {
    setStep('arquivo')
    setFileName('')
    setSheet(null)
    setMapping(null)
    setPlan(null)
    setError(null)
    setBusy(false)
    setProgress({ done: 0, total: 0 })
    setImported(0)
  }, [])

  const selectFile = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    setFileName(file.name)

    try {
      const data = await readSpreadsheet(file)

      if (!data.rows.length) {
        setError('A planilha tem cabeçalho, mas nenhuma linha de dados.')
        setBusy(false)
        return
      }

      setSheet(data)
      setMapping(detectMapping(data.headers, data.rows))
      setStep('mapeamento')
    } catch (err) {
      setError(
        err instanceof SpreadsheetError
          ? err.message
          : 'Não foi possível ler o arquivo. Confira se ele não está aberto no Excel e tente de novo.',
      )
    }

    setBusy(false)
  }, [])

  const setFieldColumn = useCallback((field: ProductField, column: number) => {
    setMapping((current) => (current ? { ...current, [field]: column } : current))
  }, [])

  /** Campos obrigatórios que ainda não têm coluna escolhida. */
  const missingRequired = useMemo(() => {
    if (!mapping) return []
    return PRODUCT_FIELDS.filter((f) => f.required && mapping[f.field] === -1).map((f) => f.label)
  }, [mapping])

  const buildPlan = useCallback(async () => {
    if (!sheet || !mapping) return

    setBusy(true)
    const existing = await getAllProducts()
    setPlan(buildImportPlan(sheet.rows, mapping, existing))
    setBusy(false)
    setStep('revisao')
  }, [sheet, mapping])

  const apply = useCallback(async () => {
    if (!plan) return

    const drafts = draftsToImport(plan)
    setError(null)
    setStep('aplicando')
    setProgress({ done: 0, total: drafts.length })

    try {
      const count = await bulkCreate(drafts, (done, total) => setProgress({ done, total }))

      setImported(count)
      setStep('resumo')
      onImported()
    } catch {
      // Sem isto a tela ficava parada em "0 de N" para sempre quando o
      // servidor falhava. Voltar para a revisão deixa tentar de novo: o
      // servidor ignora SKU e código de barras que já existem, então
      // reenviar o que já foi gravado não duplica nada.
      setError(
        'Não foi possível concluir a importação. Parte dos produtos pode já ter sido gravada; tentar de novo é seguro, o que já existe é ignorado.',
      )
      setStep('revisao')
    }
  }, [plan, onImported])

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
    step,
    setStep,
    fileName,
    sheet,
    mapping,
    plan,
    error,
    busy,
    progress,
    imported,
    missingRequired,
    reset,
    selectFile,
    setFieldColumn,
    buildPlan,
    apply,
    sampleOf,
  }
}
