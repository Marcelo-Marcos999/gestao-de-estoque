import { Progress } from '@/shared/ui/Progress'
import { CheckIcon } from '@/shared/ui/icons'
import type { Progress as ProgressValue } from '../../import/useImportWizard'
import styles from './DoneStep.module.css'

export function ApplyingStep({ progress }: { progress: ProgressValue }) {
  return (
    <div className={styles.progress}>
      <Progress value={progress.done} max={progress.total} label="Importando estoque" />
    </div>
  )
}

interface DoneStepProps {
  updated: number
  pendingCreated: number
}

export function DoneStep({ updated, pendingCreated }: DoneStepProps) {
  return (
    <div className={styles.center}>
      <span className={styles.icon}>
        <CheckIcon width={26} height={26} />
      </span>

      <p className={styles.text}>
        <strong>{updated.toLocaleString('pt-BR')}</strong> produto
        {updated === 1 ? '' : 's'} atualizado{updated === 1 ? '' : 's'}.
        {pendingCreated > 0 && (
          <>
            {' '}
            <strong>{pendingCreated.toLocaleString('pt-BR')}</strong> entrou
            {pendingCreated === 1 ? '' : 'ram'} como pendente de cadastro.
          </>
        )}
      </p>
    </div>
  )
}
