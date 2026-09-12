import styles from './ImportWizardSteps.module.css'

export interface ImportStepLabel {
  id: string
  label: string
}

interface ImportWizardStepsProps {
  steps: ImportStepLabel[]
  /** Etapa atual. Uma etapa "em andamento" que não tem parada própria no
   * trilho (como "aplicando") deve ser traduzida pelo chamador para a parada
   * mais próxima antes de chegar aqui — este componente só sabe desenhar o
   * trilho, não a máquina de estados por trás dele. */
  currentId: string
}

/**
 * Trilho de progresso de um assistente de importação. Genérico o bastante
 * para servir ao cadastro de produtos e à importação de estoque com o mesmo
 * componente, em vez de duas cópias do mesmo desenho (ver CLAUDE.md).
 */
export function ImportWizardSteps({ steps, currentId }: ImportWizardStepsProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentId)

  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={[
            styles.step,
            index === currentIndex ? styles.current : '',
            index < currentIndex ? styles.done : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-current={index === currentIndex ? 'step' : undefined}
        >
          <span className={styles.number}>{index < currentIndex ? '✓' : index + 1}</span>
          {step.label}
          {index < steps.length - 1 && <span className={styles.divider} />}
        </li>
      ))}
    </ol>
  )
}
