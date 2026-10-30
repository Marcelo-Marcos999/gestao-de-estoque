import type { ImportConfig } from '@/shared/import/useSpreadsheetImport'
import { getAllProducts } from '@/features/products'
import { loadItems } from '../api'
import { EXPIRY_IMPORT_FIELDS, type ExpiryImportField } from './columns'
import { importExpiryLots, type ExpiryImportResult } from './importApi'
import { buildExpiryPlan, checkExpiryMapping, type ExpiryImportPlan } from './plan'

/** Definido fora de qualquer componente: o assistente exige uma `config` estável. */
export const EXPIRY_IMPORT: ImportConfig<ExpiryImportField, null, ExpiryImportPlan, ExpiryImportResult> = {
  fields: EXPIRY_IMPORT_FIELDS,
  initialOptions: null,
  checkMapping: checkExpiryMapping,
  buildPlan: async (sheet, mapping) => {
    const [products, existing] = await Promise.all([getAllProducts(), loadItems()])
    return buildExpiryPlan(sheet, mapping, products, existing)
  },
  apply: importExpiryLots,
  applicableCount: (plan) => plan.counts.novo,
  failureMessage:
    'Não foi possível concluir a importação. Parte dos lotes pode já ter sido gravada: a revisão abaixo foi atualizada e mostra só o que falta.',
}
