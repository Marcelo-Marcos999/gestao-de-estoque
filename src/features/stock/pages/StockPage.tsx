import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth'
import { ProductsSkeleton } from '@/features/products'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { useSelection } from '@/shared/hooks/useSelection'
import { useStoreScope } from '@/shared/hooks/useStoreScope'
import { StoreFilter } from '@/shared/ui/StoreFilter'
import { useSort } from '@/shared/hooks/useSort'
import { SelectionBar } from '@/shared/ui/SelectionBar'
import { DeleteStockDialog, type DeleteTarget } from '../components/DeleteStockDialog'
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
import { rowKey, type StockRow } from '../types'
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
 * produto — só importar a planilha, corrigir os quatro números à mão e apagar
 * estoque (linhas marcadas ou tudo) para reimportar do zero. Identidade do
 * produto (descrição, código de barras) é só leitura, vinda do cadastro.
 */
export function StockPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  // O administrador vê as lojas todas da conta (e filtra por uma); o operador, só a própria.
  const scope = useStoreScope('estoque', isAdmin)
  const list = useStockList(scope.param)
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

  // Cada perfil seleciona e exclui na sua loja; o servidor recusa outra loja (403).
  const visibleKeys = sort.sortedRows.map(rowKey)
  const selectionState = useSelection(visibleKeys)

  // `key` muda a cada abertura: remonta o diálogo e esvazia a palavra digitada.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ target: DeleteTarget; key: number }>({
    target: { kind: 'all' },
    key: 0,
  })

  function askDelete(target: DeleteTarget) {
    setDeleteTarget((current) => ({ target, key: current.key + 1 }))
    setDeleteOpen(true)
  }

  // "Excluir tudo" age sobre UMA loja. Com várias lojas à vista é a escolhida no
  // filtro; em "todas as lojas" o botão some, para ninguém apagar a loja errada.
  const clearStore = scope.stores.find((store) => store.id === scope.filter)
  // Operador e administrador apagam a sua loja; `multi` só existe para o administrador.
  const canClearAll = !scope.multi || clearStore !== undefined

  // Trocar de filtro limpa a seleção: uma linha marcada e depois escondida por
  // um filtro novo não pode ser excluída sem a pessoa vê-la mais.
  useEffect(() => {
    selectionState.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.filters])

  const acoes = (
    <StockActions
      rows={list.rows}
      canClear={canClearAll}
      onImport={() => setImportOpen(true)}
      onNew={() => setNovoAberto(true)}
      onClear={() =>
        askDelete({ kind: 'all', storeId: scope.multi ? clearStore?.id : undefined, storeName: scope.multi ? clearStore?.name : undefined })
      }
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

      <StoreFilter scope={scope} />

      <SelectionBar
        selected={selectionState.selection.size}
        total={visibleKeys.length}
        onSelectAll={selectionState.selectAll}
        onClear={selectionState.clear}
        onDelete={() =>
          askDelete({
            kind: 'rows',
            rows: sort.sortedRows
              .filter((row) => selectionState.selection.has(rowKey(row)))
              .map((row) => ({ storeId: row.storeId, productId: row.productId })),
          })
        }
      />

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
          selection={selectionState.selection}
          onToggleSelect={selectionState.toggle}
          showStore={scope.multi}
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
        target={deleteTarget.target}
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
