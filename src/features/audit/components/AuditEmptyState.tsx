import { Button } from '@/shared/ui/Button'
import { PlusIcon } from '@/shared/ui/icons'
import styles from './AuditEmptyState.module.css'

interface AuditEmptyStateProps {
  /** Há contagem, mas o filtro escondeu tudo: o caminho é limpar, não contar. */
  filtered: boolean
  onClear: () => void
  onAdd: () => void
}

export function AuditEmptyState({ filtered, onClear, onAdd }: AuditEmptyStateProps) {
  return (
    <div className={styles.box}>
      {filtered ? (
        <>
          <p className={styles.title}>Nenhum produto contado com esse filtro</p>
          <p className={styles.text}>A contagem existe; o filtro ativo a está escondendo.</p>
          <Button variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </>
      ) : (
        <>
          <p className={styles.title}>Nenhuma contagem ainda</p>
          <p className={styles.text}>
            Conte um produto na prateleira e registre aqui. Cada registro soma à contagem do mesmo
            produto, e a tela compara com o estoque.
          </p>
          <Button onClick={onAdd}>
            <PlusIcon width={18} height={18} />
            <span>Adicionar contagem</span>
          </Button>
        </>
      )}
    </div>
  )
}

export function AuditErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.box} role="alert">
      <p className={styles.title}>Não foi possível carregar a auditoria</p>
      <p className={styles.text}>Verifique a conexão e tente de novo.</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  )
}
