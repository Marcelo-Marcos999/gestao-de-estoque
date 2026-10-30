import { useCallback, useMemo, useState } from 'react'
import { cellToText } from '@/shared/lib/cell'
import { ApiError } from '@/shared/lib/http'
import { readSpreadsheet, SpreadsheetError, type SheetData } from '@/shared/lib/spreadsheet'
import { bulkUpsertStock, getAllProducts } from '@/features/products'
import { checkStockMapping, detectMapping, type ColumnMapping, type StockField } from './columns'
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
  const [createPending, setCreatePending] = useState(true)
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
    setCreatePending(true)
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

  /** Por que ainda não dá para conferir a planilha (ou `null`): falta um jeito de achar o produto. */
  const mappingProblem = useMemo(() => (mapping ? checkStockMapping(mapping) : null), [mapping])

  const buildPlan = useCallback(async () => {
    if (!sheet || !mapping) return

    setBusy(true)
    const existing = await getAllProducts()
    setPlan(buildImportPlan(sheet.rows, mapping, existing, { createPending }))
    setBusy(false)
    setStep('revisao')
  }, [sheet, mapping, createPending])

  const apply = useCallback(async () => {
    if (!plan) return

    const rows = rowsToImport(plan)
    setError(null)
    setStep('aplicando')
    setProgress({ done: 0, total: rows.length })

    try {
      const result = await bulkUpsertStock(rows, (done, total) => setProgress({ done, total }))

      setApplied(result)
      setStep('resumo')
      onImported()
    } catch (err) {
      // Sem isto a tela ficava parada em "0 de N" para sempre quando o
      // servidor falhava. Voltar para a revisão deixa tentar de novo: reaplicar
      // a mesma planilha é seguro, porque importar estoque só sobrescreve os
      // números do SKU — o resultado final é o mesmo.
      //
      // Quando o servidor recusa, o motivo dele vai junto: "tente de novo" sem
      // dizer o que deu errado deixava a pessoa repetindo o mesmo envio.
      const motivo = err instanceof ApiError && err.status < 500 ? ` ${err.message}` : ''
      setError(
        `Não foi possível concluir a importação.${motivo} Parte das linhas pode já ter sido gravada; tentar de novo é seguro.`,
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
    applied,
    mappingProblem,
    createPending,
    setCreatePending,
    reset,
    selectFile,
    setFieldColumn,
    buildPlan,
    apply,
    sampleOf,
  }
}
