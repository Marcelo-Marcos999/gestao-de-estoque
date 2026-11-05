import { Button } from '@/shared/ui/Button'
import { PlusIcon } from '@/shared/ui/icons'
import styles from './OrdersEmptyState.module.css'

interface OrdersEmptyStateProps {
  /** Há pedidos, mas o filtro escondeu todos: o caminho é limpar, não criar. */
  filtered: boolean
  onClear: () => void
  onNew: () => void
}

export function OrdersEmptyState({ filtered, onClear, onNew }: OrdersEmptyStateProps) {
  return (
    <div className={styles.box}>
      {filtered ? (
        <>
          <p className={styles.title}>Nenhum pedido com esse filtro</p>
          <p className={styles.text}>Os pedidos existem; o filtro ativo os está escondendo.</p>
          <Button variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </>
      ) : (
        <>
          <p className={styles.title}>Nenhum pedido ainda</p>
          <p className={styles.text}>
            Crie o pedido de um cliente, adicione os produtos (o preço e o saldo vêm do estoque) e
            feche com o total a pagar.
          </p>
          <Button onClick={onNew}>
            <PlusIcon width={18} height={18} />
            <span>Novo pedido</span>
          </Button>
        </>
      )}
    </div>
  )
}

export function OrdersErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.box} role="alert">
      <p className={styles.title}>Não foi possível carregar os pedidos</p>
      <p className={styles.text}>Verifique a conexão e tente de novo.</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  )
}
