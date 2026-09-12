import { useCallback } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { ImportFileStep } from '@/shared/ui/ImportFileStep'
import { ImportWizardSteps } from '@/shared/ui/ImportWizardSteps'
import { useImportWizard } from '../import/useImportWizard'
import { ApplyingStep, DoneStep } from './import/DoneStep'
import { MappingStep } from './import/MappingStep'
import { ReviewStep } from './import/ReviewStep'

const STEP_LABELS = [
  { id: 'arquivo', label: 'Arquivo' },
  { id: 'mapeamento', label: 'Colunas' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'resumo', label: 'Conclusão' },
]

interface ImportWizardProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

/**
 * Costura as etapas da importação. Toda a lógica vive em `useImportWizard`;
 * aqui só decidimos qual etapa aparece e quais botões o rodapé oferece.
 */
export function ImportWizard({ open, onClose, onImported }: ImportWizardProps) {
  const wizard = useImportWizard(onImported)
  const { reset } = wizard

  const close = useCallback(() => {
    onClose()
    // Espera a animação de saída antes de zerar, para o conteúdo não sumir
    // na frente do usuário enquanto o diálogo ainda está visível.
    setTimeout(reset, 200)
  }, [onClose, reset])

  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Importar planilha"
      subtitle={wizard.fileName || 'Traga a base de produtos do ERP para o sistema.'}
      footer={<Footer wizard={wizard} onCancel={close} />}
    >
      <ImportWizardSteps
        steps={STEP_LABELS}
        // 'aplicando' não é uma parada do trilho: é a última etapa em andamento.
        currentId={wizard.step === 'aplicando' ? 'resumo' : wizard.step}
      />

      {wizard.error && <Alert tone="danger">{wizard.error}</Alert>}

      {wizard.step === 'arquivo' && (
        <ImportFileStep busy={wizard.busy} onSelect={(file) => void wizard.selectFile(file)} />
      )}

      {wizard.step === 'mapeamento' && wizard.sheet && wizard.mapping && (
        <MappingStep
          sheet={wizard.sheet}
          mapping={wizard.mapping}
          missingRequired={wizard.missingRequired}
          onChange={wizard.setFieldColumn}
          sampleOf={wizard.sampleOf}
        />
      )}

      {wizard.step === 'revisao' && wizard.plan && <ReviewStep plan={wizard.plan} />}

      {wizard.step === 'aplicando' && <ApplyingStep progress={wizard.progress} />}

      {wizard.step === 'resumo' && (
        <DoneStep imported={wizard.imported} skipped={wizard.plan?.counts.existente ?? 0} />
      )}
    </Dialog>
  )
}

type Wizard = ReturnType<typeof useImportWizard>

/** Cada etapa oferece só as ações que fazem sentido nela. */
function Footer({ wizard, onCancel }: { wizard: Wizard; onCancel: () => void }) {
  switch (wizard.step) {
    case 'arquivo':
      return (
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      )

    case 'mapeamento':
      return (
        <>
          <Button variant="secondary" onClick={() => wizard.setStep('arquivo')}>
            Trocar arquivo
          </Button>
          <Button
            onClick={() => void wizard.buildPlan()}
            loading={wizard.busy}
            disabled={wizard.missingRequired.length > 0}
          >
            Conferir o que será importado
          </Button>
        </>
      )

    case 'revisao':
      return (
        <>
          <Button variant="secondary" onClick={() => wizard.setStep('mapeamento')}>
            Voltar
          </Button>
          <Button
            onClick={() => void wizard.apply()}
            disabled={!wizard.plan || wizard.plan.counts.novo === 0}
          >
            Importar {wizard.plan?.counts.novo.toLocaleString('pt-BR')} produtos
          </Button>
        </>
      )

    // Durante a gravação não há nada a decidir: interromper deixaria a base
    // pela metade sem o usuário saber onde parou.
    case 'aplicando':
      return null

    case 'resumo':
      return <Button onClick={onCancel}>Concluir</Button>
  }
}
