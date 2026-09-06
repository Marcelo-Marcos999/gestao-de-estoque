import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { PlusIcon, SearchIcon } from '@/shared/ui/icons'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { BreakageToolbar } from '../components/BreakageToolbar'
import { AttachmentViewer } from '../components/AttachmentViewer'
import { LossRecordCard } from '../components/LossRecordCard'
import { LossRecordDialog } from '../components/LossRecordDialog'
import { LossRecordTable } from '../components/LossRecordTable'
import { SelectionBar } from '../components/SelectionBar'
import { UndoBar } from '../components/UndoBar'
import { exportLossRecords } from '../export'
import { useLossRecordList } from '../hooks/useLossRecordList'
import { useTagLists } from '../hooks/useTagLists'
import type { Attachment, LossRecord } from '../types'
import styles from './BreakagePage.module.css'

/** Diálogo fechado, criando um registro novo, ou alterando um existente. */
type DialogState = { open: false } | { open: true; record?: LossRecord }

/**
 * Quebra: tudo que saiu do estoque sem ser vendido.
 *
 * A ação principal é registrar, não consultar — por isso o botão fica no topo,
 * onde a mão alcança: quem está no corredor abre a tela para apontar uma perda
 * que tem na mão.
 */
export function BreakagePage() {
  const list = useLossRecordList()
  const [dialog, setDialog] = useState<DialogState>({ open: false })

  // Mesmo corte da tela de validades: abaixo disso nenhuma tabela cabe, e a
  // lista vira cartão. Um só listener para a lista inteira.
  const isNarrow = useMediaQuery('(max-width: 719px)')
  const focus = useFocusMode()

  /** Anexo aberto no visualizador. */
  const [viewing, setViewing] = useState<Attachment | null>(null)

  function openAttachment(record: LossRecord, attachmentId: string) {
    setViewing(record.attachments.find((a) => a.id === attachmentId) ?? null)
  }

  // A tela só lê as listas — quem cria etiqueta é o formulário, e ele lê o
  // storage de novo ao abrir.
  const { reasons, origins } = useTagLists()

  const vazio = list.status === 'ready' && list.records.length === 0

  /**
   * As ações acompanham o cabeçalho quando ele existe e migram para a barra de
   * busca no modo foco. Registrar é o que se vem fazer nesta tela: escondê-la
   * junto com o título transformaria o modo foco num beco.
   */
  const acoes = (
    <>
      {/* Exporta o que está na tela, com os filtros aplicados: quem filtrou por
          um motivo quer levar aquele recorte, não a base. */}
      <ExportButton
        count={list.records.length}
        onExport={() => exportLossRecords(list.records, reasons, origins)}
      />

      <Button onClick={() => setDialog({ open: true })} aria-label="Registrar quebra">
        <PlusIcon width={18} height={18} />
        <span className={styles.labelExtra}>Registrar quebra</span>
      </Button>
    </>
  )

  return (
    <div className={styles.page} {...{ [PAGE_SCROLLER_ATTR]: '' }}>
      {!focus.focused && (
        <header className={styles.header}>
          <div className={styles.titles}>
            <h1 className={styles.title}>Quebra</h1>
            <span className={styles.count}>
              {list.status === 'ready'
                ? `${list.records.length.toLocaleString('pt-BR')} ${
                    list.records.length === 1 ? 'registro' : 'registros'
                  }`
                : 'carregando…'}
            </span>
          </div>

          <div className={styles.actions}>{acoes}</div>
        </header>
      )}

      <BreakageToolbar
        filters={list.filters}
        matching={list.records.length}
        isFiltered={list.isFiltered}
        focused={focus.focused}
        focusAvailable={focus.available}
        actions={focus.focused ? acoes : null}
        onSearch={list.setSearch}
        onStockState={list.setStockState}
        onClear={list.clearFilters}
        onToggleFocus={focus.toggle}
      />

      <SelectionBar
        selected={list.selection.size}
        total={list.records.length}
        onSelectAll={list.selectAll}
        onClear={list.clearSelection}
        onDelete={() => void list.removeSelected()}
      />

      {list.status === 'loading' && (
        <div className={styles.list} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      )}

      {list.status === 'error' && (
        <div className={styles.state}>
          <Alert tone="danger">
            Não foi possível carregar os registros. Verifique a conexão e tente novamente.
          </Alert>
          <Button variant="secondary" onClick={list.reload}>
            Tentar de novo
          </Button>
        </div>
      )}

      {vazio && (
        <div className={styles.state}>
          <span className={styles.stateIcon}>
            <SearchIcon width={26} height={26} />
          </span>
          <p className={styles.stateTitle}>
            {list.isFiltered ? 'Nenhum registro encontrado' : 'Nenhuma quebra registrada'}
          </p>
          <p className={styles.stateText}>
            {list.isFiltered
              ? 'Nenhum registro corresponde à busca. Tente outro termo ou limpe os filtros.'
              : 'Registre o que saiu do estoque sem ser vendido — vencido, danificado ou divergência.'}
          </p>
          {list.isFiltered ? (
            <Button variant="secondary" onClick={list.clearFilters}>
              Limpar filtros
            </Button>
          ) : (
            <Button onClick={() => setDialog({ open: true })}>Registrar quebra</Button>
          )}
        </div>
      )}

      {list.status === 'ready' &&
        list.records.length > 0 &&
        (isNarrow ? (
          <div className={styles.list}>
            {list.records.map((record) => (
              <LossRecordCard
                key={record.id}
                record={record}
                reasons={reasons}
                origins={origins}
                selected={list.selection.has(record.id)}
                onToggleSelect={list.toggleSelected}
                onEdit={(alvo) => setDialog({ open: true, record: alvo })}
                onOpenAttachment={openAttachment}
              />
            ))}
          </div>
        ) : (
          <LossRecordTable
            records={list.records}
            reasons={reasons}
            origins={origins}
            selection={list.selection}
            onToggleSelect={list.toggleSelected}
            onEdit={(alvo) => setDialog({ open: true, record: alvo })}
            onDelete={(alvo) => void list.remove([alvo.id])}
            onOpenAttachment={openAttachment}
          />
        ))}

      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />

      <UndoBar
        records={list.undoable}
        onUndo={() => void list.undo()}
        onDismiss={list.dismissUndo}
      />

      <LossRecordDialog
        open={dialog.open}
        record={dialog.open ? dialog.record : undefined}
        onClose={() => setDialog({ open: false })}
        onSaved={list.reload}
      />
    </div>
  )
}
