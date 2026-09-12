import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { LayersIcon, PlusIcon, UploadIcon } from '@/shared/ui/icons'
import styles from './StockEmptyState.module.css'

interface EmptyStateProps {
  filtered: boolean
  onClear: () => void
  onImport: () => void
  onAdd: () => void
}

/** Os dois perfis importam, então esta tela nunca fica "esperando o administrador". */
export function StockEmptyState({ filtered, onClear, onImport, onAdd }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <span className={styles.icon}>
        <LayersIcon width={26} height={26} />
      </span>

      {filtered ? (
        <>
          <p className={styles.title}>Nenhum produto encontrado</p>
          <p className={styles.text}>
            Nenhum produto corresponde à busca. Tente outro termo ou limpe os filtros.
          </p>
          <Button variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </>
      ) : (
        <>
          <p className={styles.title}>Nenhum número de estoque ainda</p>
          <p className={styles.text}>
            Importe a planilha de saldo, saídas, custo e venda do ERP. Produtos que ainda não
            estão no cadastro entram como pendentes.
          </p>
          <div className={styles.actions}>
            <Button onClick={onImport}>
              <UploadIcon width={18} height={18} />
              Importar planilha
            </Button>
            {/* Quem ainda não tem o arquivo do ERP em mãos não fica sem saída. */}
            <Button variant="secondary" onClick={onAdd}>
              <PlusIcon width={18} height={18} />
              Adicionar produto
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function StockErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.state}>
      <Alert tone="danger">
        Não foi possível carregar o estoque. Verifique a conexão e tente novamente.
      </Alert>
      <Button variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  )
}
