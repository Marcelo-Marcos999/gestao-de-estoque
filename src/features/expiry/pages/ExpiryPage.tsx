import { useEffect, useState } from 'react'
import { SelectionBar } from '@/shared/ui/SelectionBar'
import { UndoBar } from '@/shared/ui/UndoBar'
import { LossRecordDialog, OriginChoiceDialog } from '@/features/breakage'
import { ProductsSkeleton } from '@/features/products'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { useSelection } from '@/shared/hooks/useSelection'
import { BoltIcon } from '@/shared/ui/icons'
import { StoreFilter } from '@/shared/ui/StoreFilter'
import { useStoreScope } from '@/shared/hooks/useStoreScope'
import { useAuth } from '@/features/auth'
import { useSort } from '@/shared/hooks/useSort'
import { ExpiryActions } from '../components/ExpiryActions'
import { ExpiryEmptyState, ExpiryErrorState } from '../components/ExpiryEmptyState'
import { ExpiryTable, type ExpirySortKey } from '../components/ExpiryTable'
import { ExpiryToolbar } from '../components/ExpiryToolbar'
import { ExpiryTotals } from '../components/ExpiryTotals'
import { ExpiryImportDialog } from '../components/ExpiryImportDialog'
import { NewExpiryDialog } from '../components/NewExpiryDialog'
import { SituationTiles } from '../components/SituationTiles'
import { ExpiryDialog } from '../components/ExpiryDialog'
import { useBulkGenerateBreakage } from '../hooks/useBulkGenerateBreakage'
import { useExpiryEditor } from '../hooks/useExpiryEditor'
import { useExpiryList } from '../hooks/useExpiryList'
import { useGenerateBreakage } from '../hooks/useGenerateBreakage'
import { expiryValueOf } from '../sort'
import type { ExpiryRow } from '../types'
import styles from './ExpiryPage.module.css'

/**
 * Acompanhamento de validades.
 *
 * A tela existe para responder uma pergunta por vez: o que precisa de decisão
 * hoje. Por isso abre ordenada da pior situação para a melhor, e os quatro
 * cartões do topo são o filtro — clicar num deles restringe a lista.
 */
export function ExpiryPage() {
  // O administrador vê as lojas todas da conta (e filtra por uma); o operador, só a própria.
  const scope = useStoreScope('validades', useAuth().user?.role === 'admin')
  const list = useExpiryList(scope.param)
  const [novoAberto, setNovoAberto] = useState(false)
  const [importAberto, setImportAberto] = useState(false)
  const isNarrow = useMediaQuery('(max-width: 719px)')
  const focus = useFocusMode()
  const editor = useExpiryEditor(list.reload)
  const breakage = useGenerateBreakage(editor.removeItems)
  const sort = useSort<ExpiryRow, ExpirySortKey>(list.rows, expiryValueOf)
  const rowHeight = isNarrow ? 128 : 62

  const visibleIds = sort.sortedRows.map((row) => row.id)
  const selectionState = useSelection(visibleIds)
  const bulkBreakage = useBulkGenerateBreakage(editor.removeItems, selectionState.clear)
  const selectedRows = sort.sortedRows.filter((row) => selectionState.selection.has(row.id))
  // Só faz sentido quando NENHUMA revisão de motivo é necessária: todo
  // selecionado precisa estar na faixa "venceu", senão o botão nem aparece
  // (ver docs/dominio.md).
  const podeEnviarQuebra =
    selectedRows.length > 0 && selectedRows.every((row) => row.situation === 'venceu')

  // Trocar de filtro limpa a seleção — mesma regra da Quebra: um lote
  // marcado e depois escondido por um filtro novo não devia poder ser
  // excluído ou enviado para quebra sem que a pessoa o veja mais.
  useEffect(() => {
    selectionState.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.filters])

  function deleteSelected() {
    const ids = [...selectionState.selection]
    selectionState.clear()
    void editor.removeItems(ids)
  }

  const acoes = (
    <ExpiryActions
      rows={list.rows}
      periodDays={list.periodDays}
      onImport={() => setImportAberto(true)}
      onNew={() => setNovoAberto(true)}
    />
  )

  return (
    <div className={styles.page} {...{ [PAGE_SCROLLER_ATTR]: '' }}>
      {!focus.focused && (
        <header className={styles.header}>
          <div className={styles.titles}>
            <h1 className={styles.title}>Validades</h1>
            <span className={styles.count}>
              {list.status === 'ready'
                ? `${list.overall.toLocaleString('pt-BR')} lotes acompanhados`
                : 'carregando…'}
            </span>
          </div>

          <div className={styles.actions}>{acoes}</div>
        </header>
      )}

      {/* Os cartões saem no modo foco: são 130px de altura, o maior pedaço de
          tela que dá para devolver à lista. O filtro que eles aplicam continua
          visível na faixa abaixo, com o botão de limpar — senão a lista
          filtrada pareceria a lista inteira (ver CLAUDE.md). */}
      {!focus.focused && (
        <>
          <SituationTiles
            counts={list.counts}
            selected={list.filters.situations}
            onToggle={list.toggleSituation}
          />
          <ExpiryTotals rows={list.rows} />
        </>
      )}

      <ExpiryToolbar
        filters={list.filters}
        isFiltered={list.isFiltered}
        matching={list.matching}
        narrow={isNarrow}
        focused={focus.focused}
        focusAvailable={focus.available}
        actions={focus.focused ? acoes : null}
        periodDays={list.periodDays}
        onSearch={list.setSearch}
        onPeriodChange={list.setPeriodDays}
        onExpiryRangeChange={list.setExpiryRange}
        onNumberRangeChange={list.setNumberRange}
        onClearRanges={list.clearRanges}
        onClear={list.clearFilters}
        onToggleFocus={focus.toggle}
      />

      <StoreFilter scope={scope} />

      <SelectionBar
        selected={selectionState.selection.size}
        total={visibleIds.length}
        onSelectAll={selectionState.selectAll}
        onClear={selectionState.clear}
        onDelete={deleteSelected}
        extraAction={
          podeEnviarQuebra
            ? {
                label: 'Gerar quebra',
                icon: <BoltIcon width={16} height={16} />,
                onClick: () => bulkBreakage.ask(selectedRows),
              }
            : undefined
        }
      />

      {list.status === 'loading' && <ProductsSkeleton rowHeight={rowHeight} />}

      {list.status === 'error' && <ExpiryErrorState onRetry={list.reload} />}

      {list.status === 'ready' && list.rows.length === 0 && (
        <ExpiryEmptyState
          filtered={list.isFiltered}
          onClear={list.clearFilters}
          onNew={() => setNovoAberto(true)}
        />
      )}

      {list.status === 'ready' && list.rows.length > 0 && (
        <ExpiryTable
          rows={sort.sortedRows}
          estimatedRowHeight={rowHeight}
          narrow={isNarrow}
          onEdit={editor.open}
          onDelete={(row) => void editor.removeItems([row.id])}
          onGenerateBreakage={breakage.open}
          showStore={scope.multi}
          selection={selectionState.selection}
          onToggleSelect={selectionState.toggle}
          sortKey={sort.sortKey}
          sortDir={sort.sortDir}
          onSort={sort.cycleSort}
        />
      )}

      <ExpiryDialog
        row={editor.editing}
        saving={editor.saving}
        onClose={editor.close}
        onSave={(edit) => void editor.save(edit)}
        onDelete={() => void editor.remove()}
      />

      <ExpiryImportDialog
        open={importAberto}
        onClose={() => setImportAberto(false)}
        onImported={list.reload}
      />

      <NewExpiryDialog
        open={novoAberto}
        onClose={() => setNovoAberto(false)}
        onCreated={list.reload}
      />

      {/* Gerar quebra de um lote vencido: o formulário abre preenchido, com o
          mesmo caminho e as mesmas checagens do registro manual (duplicidade,
          anexos opcionais). O resto da lógica vive em `useGenerateBreakage`. */}
      <LossRecordDialog
        open={breakage.isOpen}
        initial={breakage.draft}
        onClose={breakage.close}
        onSaved={breakage.saved}
      />

      {/* Envio em massa: o motivo é "Vencido" por definição, mas a origem não
          se adivinha — pergunta uma vez para o grupo todo. */}
      <OriginChoiceDialog
        key={bulkBreakage.waiting ? 'aberto' : 'fechado'}
        open={bulkBreakage.waiting !== null}
        count={bulkBreakage.waiting?.length ?? 0}
        onClose={bulkBreakage.cancel}
        onConfirm={bulkBreakage.confirm}
      />

      <UndoBar
        count={editor.undoable.length}
        label="Lote"
        plural="lotes"
        onUndo={() => void editor.undo()}
        onDismiss={editor.dismissUndo}
      />
    </div>
  )
}
