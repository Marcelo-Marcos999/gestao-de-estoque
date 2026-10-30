import { ReviewOptions, ReviewPreview, ReviewTiles } from '@/shared/import/ReviewParts'
import { SpreadsheetImportDialog } from '@/shared/import/SpreadsheetImportDialog'
import { useSpreadsheetImport } from '@/shared/import/useSpreadsheetImport'
import { Alert } from '@/shared/ui/Alert'
import { Select } from '@/shared/ui/Select'
import { BREAKAGE_IMPORT } from '../import/config'

interface BreakageImportDialogProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

const TONE = {
  novo: 'novo',
  pendente: 'pendente',
  existente: 'existente',
  duplicado: 'duplicado',
  invalido: 'invalido',
} as const

const joinNames = (names: string[]) => names.map((n) => `“${n}”`).join(', ')

/** Importação de registros de quebra por planilha, para quem já tem a base em outro lugar. */
export function BreakageImportDialog({ open, onClose, onImported }: BreakageImportDialogProps) {
  const wizard = useSpreadsheetImport(BREAKAGE_IMPORT, onImported)

  return (
    <SpreadsheetImportDialog
      open={open}
      onClose={onClose}
      wizard={wizard}
      title="Importar quebras"
      subtitle="Traga os registros de uma base existente: produto, quantidade, motivo e origem."
      applyingLabel="Importando registros"
      renderReview={(plan, w) => (
        <>
          {(plan.missingReason > 0 || plan.missingOrigin > 0 || w.options.defaultReasonId || w.options.defaultOriginId) && (
            <ReviewOptions>
              <Alert tone="info">
                Motivo e origem são obrigatórios. Para as linhas que vieram sem eles, escolha o que
                usar; sem escolha, essas linhas ficam de fora.
              </Alert>
              <Select
                label={`Motivo das linhas sem motivo${plan.missingReason ? ` (${plan.missingReason})` : ''}`}
                value={w.options.defaultReasonId}
                onChange={(event) => void w.changeOptions({ defaultReasonId: event.target.value })}
                options={[
                  { value: '', label: 'Deixar essas linhas de fora' },
                  ...plan.reasons.map((t) => ({ value: t.id, label: t.label })),
                ]}
              />
              <Select
                label={`Origem das linhas sem origem${plan.missingOrigin ? ` (${plan.missingOrigin})` : ''}`}
                value={w.options.defaultOriginId}
                onChange={(event) => void w.changeOptions({ defaultOriginId: event.target.value })}
                options={[
                  { value: '', label: 'Deixar essas linhas de fora' },
                  ...plan.origins.map((t) => ({ value: t.id, label: t.label })),
                ]}
              />
            </ReviewOptions>
          )}

          <ReviewTiles
            tiles={[
              { value: plan.counts.novo, caption: 'produto cadastrado, serão criados', tone: 'ok' },
              { value: plan.counts.pendente, caption: 'produto fora do cadastro, entram pendentes', tone: 'warning' },
              {
                value: plan.counts.existente + plan.counts.duplicado,
                caption: 'já existem ou se repetem, ficam de fora',
                tone: 'neutral',
              },
              { value: plan.counts.invalido, caption: 'recusadas (veja o motivo abaixo)', tone: 'bad' },
            ]}
          />

          {(plan.newReasons.length > 0 || plan.newOrigins.length > 0) && (
            <Alert>
              A planilha tem nomes que ainda não estão nas listas e serão criados:
              {plan.newReasons.length > 0 && <> motivos {joinNames(plan.newReasons)}.</>}
              {plan.newOrigins.length > 0 && <> origens {joinNames(plan.newOrigins)}.</>} Confira a
              grafia: um nome digitado diferente vira um item a mais na lista.
            </Alert>
          )}

          <ReviewPreview
            total={plan.rows.length}
            rows={plan.rows.map((row) => ({
              line: row.lineNumber,
              label: row.label,
              note: row.reason ?? '',
              tone: TONE[row.status],
              problem: row.status === 'invalido' || row.status === 'duplicado',
            }))}
          />
        </>
      )}
      renderDone={(result) => (
        <>
          <p>
            <strong>{result.created.toLocaleString('pt-BR')}</strong> registro
            {result.created === 1 ? '' : 's'} de quebra importado{result.created === 1 ? '' : 's'}.
            {result.pending > 0 && (
              <>
                {' '}
                <strong>{result.pending.toLocaleString('pt-BR')}</strong> de produto
                {result.pending === 1 ? '' : 's'} fora do cadastro, pendente
                {result.pending === 1 ? '' : 's'} para o administrador completar.
              </>
            )}
          </p>
          {(result.newReasons > 0 || result.newOrigins > 0) && (
            <p>
              Criados na lista: {result.newReasons} motivo{result.newReasons === 1 ? '' : 's'} e{' '}
              {result.newOrigins} origem{result.newOrigins === 1 ? '' : 'ns'}.
            </p>
          )}
        </>
      )}
    />
  )
}
