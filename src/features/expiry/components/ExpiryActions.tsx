import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { PlusIcon, UploadIcon } from '@/shared/ui/icons'
import { exportExpiryRows } from '../export'
import type { ExpiryRow } from '../types'
import styles from './ExpiryActions.module.css'

interface ExpiryActionsProps {
  rows: ExpiryRow[]
  periodDays: number
  onImport: () => void
  onNew: () => void
}

/**
 * As ações do cabeçalho de Validades. Acompanham o cabeçalho quando ele existe e
 * migram para a barra de busca no modo foco: acompanhar um lote é o que se vem
 * fazer nesta tela, e escondê-las junto com o título faria do modo foco um beco.
 *
 * Importar saldo e saídas não é daqui: os dois números são do produto, e quem
 * os importa é a tela de Estoque. O que se importa aqui são os lotes (produto e
 * validade), que é o assunto desta tela (ver docs/dominio.md).
 */
export function ExpiryActions({ rows, periodDays, onImport, onNew }: ExpiryActionsProps) {
  return (
    <>
      <ExportButton count={rows.length} onExport={() => exportExpiryRows(rows, periodDays)} />

      <Button variant="secondary" onClick={onImport}>
        <UploadIcon width={18} height={18} />
        <span>
          Importar<span className={styles.labelExtra}> planilha</span>
        </span>
      </Button>

      <Button onClick={onNew}>
        <PlusIcon width={18} height={18} />
        <span>
          Novo<span className={styles.labelExtra}> lote</span>
        </span>
      </Button>
    </>
  )
}
