import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { PlusIcon, TrashIcon, UploadIcon } from '@/shared/ui/icons'
import { exportStockRows } from '../export'
import type { StockRow } from '../types'
import styles from './StockActions.module.css'

interface StockActionsProps {
  rows: StockRow[]
  /** Só o administrador vê "Excluir tudo": é a ação mais destrutiva da tela, e o servidor também recusa os outros. */
  canClear: boolean
  onImport: () => void
  onNew: () => void
  onClear: () => void
}

/** As ações do cabeçalho do Estoque; migram para a barra de busca no modo foco. */
export function StockActions({ rows, canClear, onImport, onNew, onClear }: StockActionsProps) {
  return (
    <>
      <ExportButton count={rows.length} onExport={() => exportStockRows(rows)} />

      <Button variant="secondary" onClick={onImport}>
        <UploadIcon width={18} height={18} />
        <span>
          Importar<span className={styles.labelExtra}> planilha</span>
        </span>
      </Button>

      {canClear && (
        <Button variant="secondary" onClick={onClear}>
          <TrashIcon width={18} height={18} />
          <span>
            Excluir<span className={styles.labelExtra}> tudo</span>
          </span>
        </Button>
      )}

      {/* A planilha é o caminho de todo dia, mas um produto solto não vale um
          arquivo só para ele — e sem esta porta a única saída seria montar uma
          planilha de uma linha. */}
      <Button onClick={onNew}>
        <PlusIcon width={18} height={18} />
        <span>
          Adicionar<span className={styles.labelExtra}> produto</span>
        </span>
      </Button>
    </>
  )
}
