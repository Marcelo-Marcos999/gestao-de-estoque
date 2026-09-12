import { useMemo } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import type { ImportPlan, RowStatus } from '../../import/plan'
import styles from './ReviewStep.module.css'

const STATUS_LABEL: Record<RowStatus, string> = {
  atualiza: 'Atualiza',
  pendente: 'Pendente',
  duplicado: 'Repetido',
  invalido: 'Inválido',
}

const TILES: Array<{ status: RowStatus; caption: string }> = [
  { status: 'atualiza', caption: 'produtos já cadastrados, números atualizados' },
  { status: 'pendente', caption: 'SKU não cadastrado, entra como pendente' },
  { status: 'duplicado', caption: 'repetidos na planilha' },
  { status: 'invalido', caption: 'sem código SKU' },
]

/**
 * O plano é mostrado antes de gravar qualquer coisa: com milhares de linhas,
 * descobrir o resultado depois é tarde demais.
 */
export function ReviewStep({ plan }: { plan: ImportPlan }) {
  return (
    <>
      <div className={styles.summary}>
        {TILES.map(({ status, caption }) => (
          <div className={`${styles.tile} ${styles[status]}`} key={status}>
            <span className={styles.value}>{plan.counts[status].toLocaleString('pt-BR')}</span>
            <span className={styles.caption}>{caption}</span>
          </div>
        ))}
      </div>

      {plan.counts.pendente > 0 && (
        <Alert>
          {plan.counts.pendente.toLocaleString('pt-BR')} SKU
          {plan.counts.pendente === 1 ? '' : 's'} não{' '}
          {plan.counts.pendente === 1 ? 'está' : 'estão'} no cadastro. O produto entra pendente,
          com estes números, e o administrador completa descrição e código de barras no
          Cadastro de produtos.
        </Alert>
      )}

      {plan.counts.atualiza === 0 && plan.counts.pendente === 0 && (
        <Alert tone="info">Nenhuma linha válida nesta planilha para aplicar.</Alert>
      )}

      <PlanPreview plan={plan} />
    </>
  )
}

/** Primeiras linhas classificadas, com o que exige atenção na frente. */
function PlanPreview({ plan }: { plan: ImportPlan }) {
  const rows = useMemo(() => {
    const problemas = plan.rows.filter((r) => r.status === 'invalido' || r.status === 'duplicado')
    const resto = plan.rows.filter((r) => r.status !== 'invalido' && r.status !== 'duplicado')
    return [...problemas, ...resto].slice(0, 60)
  }, [plan])

  const temProblema = plan.counts.invalido + plan.counts.duplicado > 0

  return (
    <>
      <p className={styles.previewTitle}>
        {temProblema
          ? 'Linhas que precisam de atenção, seguidas das demais'
          : 'Primeiras linhas da planilha'}
      </p>

      <div className={styles.preview}>
        {rows.map((r) => (
          <div className={styles.row} key={r.lineNumber}>
            <span className={styles.line}>L{r.lineNumber}</span>
            <span className={styles.sku} title={r.row.sku}>
              {r.row.sku || <em>sem SKU</em>}
            </span>
            <Badge tone={r.status}>{r.reason ?? STATUS_LABEL[r.status]}</Badge>
          </div>
        ))}

        {plan.total > rows.length && (
          <p className={styles.more}>
            e mais {(plan.total - rows.length).toLocaleString('pt-BR')} linhas
          </p>
        )}
      </div>
    </>
  )
}
