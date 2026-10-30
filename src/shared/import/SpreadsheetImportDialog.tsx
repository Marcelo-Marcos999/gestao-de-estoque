import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { ImportFileStep } from '@/shared/ui/ImportFileStep'
import { ImportWizardSteps } from '@/shared/ui/ImportWizardSteps'
import { Progress } from '@/shared/ui/Progress'
import { CheckIcon } from '@/shared/ui/icons'
import { MappingStep } from './MappingStep'
import type { SpreadsheetImport } from './useSpreadsheetImport'
import styles from './ImportDialog.module.css'

const STEP_LABELS = [
  { id: 'arquivo', label: 'Arquivo' },
  { id: 'mapeamento', label: 'Colunas' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'resumo', label: 'Conclusão' },
]

interface SpreadsheetImportDialogProps<F extends string, O, P, R> {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  wizard: SpreadsheetImport<F, O, P, R>
  renderReview: (plan: P, wizard: SpreadsheetImport<F, O, P, R>) => ReactNode
  renderDone: (result: R) => ReactNode
  applyingLabel: string
  /** Motivo de a importação ainda não poder começar (ex.: falta escolher a origem padrão). */
  blocker?: (plan: P, options: O) => string | null
}

/**
 * Costura as etapas de qualquer importação por planilha. Toda a lógica vive no
 * hook e na `config` de quem usa; aqui só se decide qual etapa aparece e quais
 * botões o rodapé oferece.
 */
export function SpreadsheetImportDialog<F extends string, O, P, R>({
  open,
  onClose,
  title,
  subtitle,
  wizard,
  renderReview,
  renderDone,
  applyingLabel,
  blocker,
}: SpreadsheetImportDialogProps<F, O, P, R>) {
  const { reset, step, plan, config } = wizard

  const close = useCallback(() => {
    onClose()
    // Espera a animação de saída antes de zerar, para o conteúdo não sumir na
    // frente de quem ainda vê o diálogo.
    setTimeout(reset, 200)
  }, [onClose, reset])

  const applicable = plan ? config.applicableCount(plan) : 0
  const blocked = plan && blocker ? blocker(plan, wizard.options) : null

  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title={title}
      subtitle={wizard.fileName || subtitle}
      footer={
        <>
          {step === 'arquivo' && (
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
          )}

          {step === 'mapeamento' && (
            <>
              <Button variant="secondary" onClick={() => wizard.setStep('arquivo')}>
                Trocar arquivo
              </Button>
              <Button
                onClick={() => void wizard.review()}
                loading={wizard.busy}
                disabled={wizard.missing.length > 0}
              >
                Conferir o que será importado
              </Button>
            </>
          )}

          {step === 'revisao' && (
            <>
              <Button variant="secondary" onClick={() => wizard.setStep('mapeamento')}>
                Voltar
              </Button>
              <Button
                onClick={() => void wizard.apply()}
                disabled={applicable === 0 || wizard.busy || blocked !== null}
              >
                Importar {applicable.toLocaleString('pt-BR')} linhas
              </Button>
            </>
          )}

          {/* Durante a gravação não há nada a decidir: interromper deixaria a
              base pela metade sem a pessoa saber onde parou. */}
          {step === 'resumo' && <Button onClick={close}>Concluir</Button>}
        </>
      }
    >
      <ImportWizardSteps steps={STEP_LABELS} currentId={step === 'aplicando' ? 'resumo' : step} />

      {wizard.error && <Alert tone="danger">{wizard.error}</Alert>}

      {step === 'arquivo' && (
        <ImportFileStep busy={wizard.busy} onSelect={(file) => void wizard.selectFile(file)} />
      )}

      {step === 'mapeamento' && wizard.sheet && wizard.mapping && (
        <MappingStep
          sheet={wizard.sheet}
          fields={config.fields}
          mapping={wizard.mapping}
          missing={wizard.missing}
          onChange={wizard.setFieldColumn}
          sampleOf={wizard.sampleOf}
        />
      )}

      {step === 'revisao' && plan && (
        <>
          {renderReview(plan, wizard)}
          {blocked && <Alert tone="info">{blocked}</Alert>}
        </>
      )}

      {step === 'aplicando' && (
        <div className={styles.progress}>
          <Progress value={wizard.progress.done} max={wizard.progress.total} label={applyingLabel} />
        </div>
      )}

      {step === 'resumo' && wizard.result !== null && (
        <div className={styles.center}>
          <span className={styles.icon}>
            <CheckIcon width={26} height={26} />
          </span>
          <div className={styles.text}>{renderDone(wizard.result)}</div>
        </div>
      )}
    </Dialog>
  )
}
