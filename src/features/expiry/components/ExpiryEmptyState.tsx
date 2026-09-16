import { Button } from '@/shared/ui/Button'
import { PlusIcon, SearchIcon } from '@/shared/ui/icons'
import styles from './ExpiryEmptyState.module.css'

interface ExpiryEmptyStateProps {
  filtered: boolean
  onClear: () => void
  onNew: () => void
}

/** Mesmo padrão do cadastro de produtos e do estoque: busca sem resultado e lista vazia pedem saídas diferentes. */
export function ExpiryEmptyState({ filtered, onClear, onNew }: ExpiryEmptyStateProps) {
  return (
    <div className={styles.state}>
      <span className={styles.icon}>
        <SearchIcon width={26} height={26} />
      </span>

      <p className={styles.title}>
        {filtered ? 'Nenhum lote encontrado' : 'Nenhum lote em acompanhamento'}
      </p>
      <p className={styles.text}>
        {filtered
          ? 'Nenhum lote corresponde à busca. Tente outro termo ou limpe os filtros.'
          : 'Comece acompanhando a validade de um produto do cadastro. Registrar uma quebra com validade também cria o lote.'}
      </p>

      {filtered ? (
        <Button variant="secondary" onClick={onClear}>
          Limpar filtros
        </Button>
      ) : (
        <Button onClick={onNew}>
          <PlusIcon width={18} height={18} />
          Novo lote
        </Button>
      )}
    </div>
  )
}
