import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth'
import { ProductsSkeleton } from '@/features/products'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { useSelection } from '@/shared/hooks/useSelection'
import { useSort } from '@/shared/hooks/useSort'
import { SelectionBar } from '@/shared/ui/SelectionBar'
import { DeleteStockDialog } from '../components/DeleteStockDialog'
import { ImportWizard } from '../components/ImportWizard'
import { NewStockDialog } from '../components/NewStockDialog'
import { StockActions } from '../components/StockActions'
import { StockEmptyState, StockErrorState } from '../components/StockEmptyState'
import { StockRowDialog } from '../components/StockRowDialog'
import { StockTable, type StockSortKey } from '../components/StockTable'
import { StockToolbar } from '../components/StockToolbar'
import { StockTotalsSummary } from '../components/StockTotalsSummary'
import { useStockEditor } from '../hooks/useStockEditor'
import { useStockList } from '../hooks/useStockList'
import { rowCostTotal, rowSaleTotal, sumStockTotals } from '../totals'
import type { StockRow } from '../types'
import styles from './StockPage.module.css'

/** O que cada coluna ordenável compara. */
function stockValueOf(row: StockRow, key: StockSortKey): string | number {
  switch (key) {
    case 'description':
      return row.description
    case 'stock':
      return row.stock
    case 'outflow':
      return row.outflow
    case 'costPrice':
      return row.costPrice
    case 'salePrice':
      return row.salePrice
    case 'totalCost':
      return rowCostTotal(row)
    case 'totalSale':
      return rowSaleTotal(row)
  }
}

/**
 * Tela de Estoque: saldo, saídas, custo e venda dos produtos, acessível aos
 * dois perfis (ver docs/dominio.md, "de onde vêm saldo e saídas").
 *
 * Diferente do cadastro de produtos, aqui não há "criar" nem "excluir" um
 * produto — só importar a planilha, corrigir os quatro números à mão e, para o
 * administrador, apagar todo o estoque para reimportar do zero. Identidade do
 * produto (descrição, código de barras) é só leitura, vinda do cadastro.
 */
export function StockPage() {
  const list = useStockList()
  const isNarrow = useMediaQuery('(max-width: 719px)')
  const focus = useFocusMode()
  const editor = useStockEditor(list.reload)
  const sort = useSort<StockRow, StockSortKey>(list.rows, stockValueOf)

  const rowHeight = isNarrow ? 108 : 56

  // Soma sobre o que está na tela, com os filtros aplicados: é o mesmo total
  // que a lista abaixo já mostra, só resumido — não a base inteira.
  const totals = useMemo(() => sumStockTotals(list.rows), [list.rows])

  const [importOpen, setImportOpen] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Só o administrador exclui: a seleção (e a coluna de marcação) nem existe para o operador.
  const visibleIds = sort.sortedRows.map((row) => row.productId)
  const selectionState = useSelection(visibleIds)

  // `ids: null` apaga o estoque inteiro. `key` muda a cada abertura: remonta o
  // diálogo e esvazia a palavra digitada.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[] | null; key: number }>({
    ids: null,
    key: 0,
  })

  function askDelete(ids: string[] | null) {
    setDeleteTarget((current) => ({ ids, key: current.key + 1 }))
    setDeleteOpen(true)
  }

  // Trocar de filtro limpa a seleção: uma linha marcada e depois escondida por
  // um filtro novo não pode ser excluída sem a pessoa vê-la mais.
  useEffect(() => {
    selectionState.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.filters])

  const acoes = (
    <StockActions
      rows={list.rows}
      canClear={isAdmin}
      onImport={() => setImportOpen(true)}
      onNew={() => setNovoAberto(true)}
      onClear={() => askDelete(null)}
    />
  )

  return (
    <div className={styles.page} {...{ [PAGE_SCROLLER_ATTR]: '' }}>
      {!focus.focused && (
        <header className={styles.header}>
          <div className={styles.titles}>
            <h1 className={styles.title}>Estoque</h1>
            <span className={styles.count}>
              {list.status === 'ready'
                ? `${list.matching.toLocaleString('pt-BR')} produtos`
                : 'carregando…'}
            </span>
          </div>

          <div className={styles.actions}>{acoes}</div>
        </header>
      )}

      {/* Sai no modo foco, junto do cabeçalho: é o mesmo total que a tabela
          abaixo já mostra por produto, só resumido. */}
      {!focus.focused && list.status === 'ready' && list.rows.length > 0 && (
        <StockTotalsSummary cost={totals.cost} sale={totals.sale} />
      )}

      <StockToolbar
        filters={list.filters}
        isFiltered={list.isFiltered}
        matching={list.matching}
        narrow={isNarrow}
        focused={focus.focused}
        focusAvailable={focus.available}
        actions={focus.focused ? acoes : null}
        onSearch={list.setSearch}
        onTogglePending={list.setOnlyPending}
        onRangeChange={list.setNumberRange}
        onClearRanges={list.clearRanges}
        onClear={list.clearFilters}
        onToggleFocus={focus.toggle}
      />

      {isAdmin && (
        <SelectionBar
          selected={selectionState.selection.size}
          total={visibleIds.length}
          onSelectAll={selectionState.selectAll}
          onClear={selectionState.clear}
          onDelete={() => askDelete([...selectionState.selection])}
        />
      )}

      {list.status === 'loading' && <ProductsSkeleton rowHeight={rowHeight} />}

      {list.status === 'error' && <StockErrorState onRetry={list.reload} />}

      {list.status === 'ready' && list.rows.length === 0 && (
        <StockEmptyState
          filtered={list.isFiltered}
          onClear={list.clearFilters}
          onImport={() => setImportOpen(true)}
          onAdd={() => setNovoAberto(true)}
        />
      )}

      {list.status === 'ready' && list.rows.length > 0 && (
        <StockTable
          rows={sort.sortedRows}
          estimatedRowHeight={rowHeight}
          narrow={isNarrow}
          onEdit={editor.open}
          selection={isAdmin ? selectionState.selection : undefined}
          onToggleSelect={isAdmin ? selectionState.toggle : undefined}
          sortKey={sort.sortKey}
          sortDir={sort.sortDir}
          onSort={sort.cycleSort}
        />
      )}

      <StockRowDialog
        row={editor.editing}
        saving={editor.saving}
        onClose={editor.close}
        onSave={(edit) => void editor.save(edit)}
      />

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={list.reload}
      />

      <DeleteStockDialog
        key={deleteTarget.key}
        open={deleteOpen}
        productIds={deleteTarget.ids}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          selectionState.clear()
          list.reload()
        }}
      />

      <NewStockDialog
        open={novoAberto}
        onClose={() => setNovoAberto(false)}
        onSaved={list.reload}
      />
    </div>
  )
}
