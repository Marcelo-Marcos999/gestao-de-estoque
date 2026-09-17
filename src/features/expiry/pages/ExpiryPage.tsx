import { useEffect, useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { SelectionBar } from '@/shared/ui/SelectionBar'
import { UndoBar } from '@/shared/ui/UndoBar'
import { LossRecordDialog } from '@/features/breakage'
import { ProductsSkeleton } from '@/features/products'
import { useAuth } from '@/features/auth'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { useSelection } from '@/shared/hooks/useSelection'
import { BoltIcon, PlusIcon } from '@/shared/ui/icons'
import { useSort } from '@/shared/hooks/useSort'
import { ExpiryEmptyState } from '../components/ExpiryEmptyState'
import { ExpiryTable, type ExpirySortKey } from '../components/ExpiryTable'
import { ExpiryToolbar } from '../components/ExpiryToolbar'
import { NewExpiryDialog } from '../components/NewExpiryDialog'
import { SituationTiles } from '../components/SituationTiles'
import { ExpiryDialog } from '../components/ExpiryDialog'
import { exportExpiryRows } from '../export'
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
  const list = useExpiryList()
  const [novoAberto, setNovoAberto] = useState(false)
  const isNarrow = useMediaQuery('(max-width: 719px)')
  const focus = useFocusMode()
  const editor = useExpiryEditor(list.reload)
  const breakage = useGenerateBreakage(editor.removeItems)
  const sort = useSort<ExpiryRow, ExpirySortKey>(list.rows, expiryValueOf)
  const rowHeight = isNarrow ? 128 : 62

  const { user } = useAuth()
  const bulkBreakage = useBulkGenerateBreakage(editor.removeItems, user?.name ?? 'Sistema')

  const visibleIds = sort.sortedRows.map((row) => row.id)
  const selectionState = useSelection(visibleIds)
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

  function sendSelectedToBreakage() {
    const rows = selectedRows
    selectionState.clear()
    void bulkBreakage.send(rows)
  }

  /**
   * As ações acompanham o cabeçalho quando ele existe e migram para a barra de
   * busca no modo foco.
   *
   * Importar saldo e saídas não é mais daqui: os dois números são do produto,
   * e quem os importa é a tela de Estoque — este cabeçalho só acompanha
   * validade, que é o assunto desta tela (ver docs/dominio.md).
   */
  const acoes = (
    <>
      <ExportButton
        count={list.rows.length}
        onExport={() => exportExpiryRows(list.rows, list.periodDays)}
      />

      {/* Acompanhar um lote é o que se vem fazer nesta tela: some no modo foco
          junto do cabeçalho, mas volta na barra de busca, como nas outras. */}
      <Button onClick={() => setNovoAberto(true)}>
        <PlusIcon width={18} height={18} />
        <span>
          Novo<span className={styles.labelExtra}> lote</span>
        </span>
      </Button>
    </>
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
        <SituationTiles
          counts={list.counts}
          selected={list.filters.situations}
          onToggle={list.toggleSituation}
        />
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
                onClick: sendSelectedToBreakage,
              }
            : undefined
        }
      />

      {list.status === 'loading' && <ProductsSkeleton rowHeight={rowHeight} />}

      {list.status === 'error' && (
        <div className={styles.state}>
          <Alert tone="danger">
            Não foi possível carregar as validades. Verifique a conexão e tente novamente.
          </Alert>
          <Button variant="secondary" onClick={list.reload}>
            Tentar de novo
          </Button>
        </div>
      )}

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
