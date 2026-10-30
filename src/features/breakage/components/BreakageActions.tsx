import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { PlusIcon, UploadIcon } from '@/shared/ui/icons'
import { exportLossRecords } from '../export'
import type { LossRecord, Tag } from '../types'
import styles from './BreakageActions.module.css'

interface BreakageActionsProps {
  records: LossRecord[]
  reasons: Tag[]
  origins: Tag[]
  onImport: () => void
  onNew: () => void
}

/**
 * As ações do cabeçalho de Quebra. Acompanham o cabeçalho quando ele existe e
 * migram para a barra de busca no modo foco. Registrar é o que se vem fazer
 * nesta tela: escondê-lo junto com o título transformaria o modo foco num beco.
 */
export function BreakageActions({ records, reasons, origins, onImport, onNew }: BreakageActionsProps) {
  return (
    <>
      {/* Exporta o que está na tela, com os filtros aplicados: quem filtrou por
          um motivo quer levar aquele recorte, não a base. */}
      <ExportButton
        count={records.length}
        onExport={() => exportLossRecords(records, reasons, origins)}
      />

      <Button variant="secondary" onClick={onImport}>
        <UploadIcon width={18} height={18} />
        <span>
          Importar<span className={styles.labelExtra}> planilha</span>
        </span>
      </Button>

      <Button onClick={onNew}>
        <PlusIcon width={18} height={18} />
        {/* Só "quebra" sai no celular: um "+" sozinho não diz o que faz. */}
        <span>
          Registrar<span className={styles.labelExtra}> quebra</span>
        </span>
      </Button>
    </>
  )
}
