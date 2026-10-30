import { ReviewPreview, ReviewTiles } from '@/shared/import/ReviewParts'
import { SpreadsheetImportDialog } from '@/shared/import/SpreadsheetImportDialog'
import { useSpreadsheetImport } from '@/shared/import/useSpreadsheetImport'
import { Alert } from '@/shared/ui/Alert'
import { EXPIRY_IMPORT } from '../import/config'
import type { ExpiryRowStatus } from '../import/plan'

interface ExpiryImportDialogProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

const NOTE_TONE = { novo: 'novo', existente: 'existente', duplicado: 'duplicado', invalido: 'invalido' } as const
const PROBLEMS: ExpiryRowStatus[] = ['invalido', 'duplicado']

/** Importação de lotes por planilha: SKU ou código de barras, mais a validade. */
export function ExpiryImportDialog({ open, onClose, onImported }: ExpiryImportDialogProps) {
  const wizard = useSpreadsheetImport(EXPIRY_IMPORT, onImported)

  return (
    <SpreadsheetImportDialog
      open={open}
      onClose={onClose}
      wizard={wizard}
      title="Importar validades"
      subtitle="Traga os lotes de uma base existente: produto e data de validade."
      applyingLabel="Importando lotes"
      renderReview={(plan) => (
        <>
          <ReviewTiles
            tiles={[
              { value: plan.counts.novo, caption: 'lotes novos, serão criados', tone: 'ok' },
              { value: plan.counts.existente, caption: 'já existem, ficam como estão', tone: 'neutral' },
              { value: plan.counts.duplicado, caption: 'repetidos na planilha', tone: 'warning' },
              { value: plan.counts.invalido, caption: 'sem produto ou sem validade legível', tone: 'bad' },
            ]}
          />

          {plan.counts.novo > 0 && (
            <Alert>
              O saldo, as saídas e o custo de cada produto não mudam: eles vêm da tela de Estoque.
              Produto que ainda não tem estoque nesta loja entra com saldo zerado.
            </Alert>
          )}

          <ReviewPreview
            total={plan.rows.length}
            rows={plan.rows.map((row) => ({
              line: row.lineNumber,
              label: row.label,
              note: row.reason ?? '',
              tone: NOTE_TONE[row.status],
              problem: PROBLEMS.includes(row.status),
            }))}
          />
        </>
      )}
      renderDone={(result) => (
        <p>
          <strong>{result.created.toLocaleString('pt-BR')}</strong> lote
          {result.created === 1 ? '' : 's'} criado{result.created === 1 ? '' : 's'}.
          {result.ignored > 0 && (
            <>
              {' '}
              <strong>{result.ignored.toLocaleString('pt-BR')}</strong> já existia
              {result.ignored === 1 ? '' : 'm'} e foi ignorado.
            </>
          )}
        </p>
      )}
    />
  )
}
