import { useCallback, useMemo, useState } from 'react'
import { cellToText } from '@/shared/lib/cell'
import { readSpreadsheet, SpreadsheetError, type SheetData } from '@/shared/lib/spreadsheet'
import { bulkUpsertStock, getAllProducts } from '@/features/products'
import { STOCK_FIELDS, detectMapping, type ColumnMapping, type StockField } from './columns'
import { buildImportPlan, rowsToImport, type ImportPlan } from './plan'

export type Step = 'arquivo' | 'mapeamento' | 'revisao' | 'aplicando' | 'resumo'

export interface Progress {
  done: number
  total: number
}

export interface Applied {
  updated: number
  pendingCreated: number
}

/**
 * Máquina de estados da importação de estoque — mesmo desenho do assistente
 * do cadastro de produtos, com a diferença que importa: aqui não há "pular o
 * que já existe", e sim atualizar o que existe e criar como pendente o que
 * não existe (ver `import/plan.ts`).
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
  const [applied, setApplied] = useState<Applied>({ updated: 0, pendingCreated: 0 })

  const reset = useCallback(() => {
    setStep('arquivo')
    setFileName('')
    setSheet(null)
    setMapping(null)
    setPlan(null)
    setError(null)
    setBusy(false)
    setProgress({ done: 0, total: 0 })
    setApplied({ updated: 0, pendingCreated: 0 })
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
      setMapping(detectMapping(data.headers))
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

  const setFieldColumn = useCallback((field: StockField, column: number) => {
    setMapping((current) => (current ? { ...current, [field]: column } : current))
  }, [])

  const missingRequired = useMemo(() => {
    if (!mapping) return []
    return STOCK_FIELDS.filter((f) => f.required && mapping[f.field] === -1).map((f) => f.label)
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

    const rows = rowsToImport(plan)
    setStep('aplicando')
    setProgress({ done: 0, total: rows.length })

    const result = await bulkUpsertStock(rows, (done, total) => setProgress({ done, total }))

    setApplied(result)
    setStep('resumo')
    onImported()
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
    applied,
    missingRequired,
    reset,
    selectFile,
    setFieldColumn,
    buildPlan,
    apply,
    sampleOf,
  }
}
