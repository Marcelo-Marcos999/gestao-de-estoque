import type { ImportConfig } from '@/shared/import/useSpreadsheetImport'
import { getAllProducts } from '@/features/products'
import { loadRecords } from '../api'
import { loadTags } from '../tags'
import { BREAKAGE_IMPORT_FIELDS, type BreakageImportField } from './columns'
import { importLossRecords, type BreakageImportResult } from './importApi'
import { buildBreakagePlan, NO_DEFAULTS, type BreakageImportOptions, type BreakageImportPlan } from './plan'

/** Definido fora de qualquer componente: o assistente exige uma `config` estável. */
export const BREAKAGE_IMPORT: ImportConfig<
  BreakageImportField,
  BreakageImportOptions,
  BreakageImportPlan,
  BreakageImportResult
> = {
  fields: BREAKAGE_IMPORT_FIELDS,
  initialOptions: NO_DEFAULTS,
  checkMapping: (mapping) =>
    mapping.sku < 0 && mapping.barcode < 0 && mapping.description < 0
      ? 'Escolha ao menos uma coluna que identifique o produto (SKU, código de barras ou descrição).'
      : null,
  buildPlan: async (sheet, mapping, options) => {
    const [products, tags, existing] = await Promise.all([getAllProducts(), loadTags(), loadRecords()])
    return buildBreakagePlan(sheet, mapping, products, tags.reasons, tags.origins, existing, options)
  },
  apply: importLossRecords,
  applicableCount: (plan) => plan.counts.novo + plan.counts.pendente,
  failureMessage:
    'Não foi possível concluir a importação. Parte dos registros pode já ter sido gravada: a revisão abaixo foi atualizada e mostra só o que falta.',
}
