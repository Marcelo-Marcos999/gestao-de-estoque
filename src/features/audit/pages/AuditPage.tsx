import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth'
import { ProductsSkeleton } from '@/features/products'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useSelection } from '@/shared/hooks/useSelection'
import { useSort } from '@/shared/hooks/useSort'
import { useStoreScope } from '@/shared/hooks/useStoreScope'
import { formatMoney } from '@/shared/lib/money'
import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { PlusIcon, TrashIcon } from '@/shared/ui/icons'
import { SelectionBar } from '@/shared/ui/SelectionBar'
import { StoreFilter } from '@/shared/ui/StoreFilter'
import { TotalTiles } from '@/shared/ui/TotalTiles'
import { sumAuditTotals } from '../compute'
import { exportAuditRows } from '../export'
import { useAuditList } from '../hooks/useAuditList'
import { rowKey, type AuditRow } from '../types'
import { AuditEmptyState, AuditErrorState } from '../components/AuditEmptyState'
import { AuditEntriesDialog } from '../components/AuditEntriesDialog'
import { AuditTable, auditValueOf, type AuditSortKey } from '../components/AuditTable'
import { AuditToolbar } from '../components/AuditToolbar'
import { ClearAuditDialog } from '../components/ClearAuditDialog'
import { DeleteAuditItemsDialog } from '../components/DeleteAuditItemsDialog'
import { NewCountDialog } from '../components/NewCountDialog'
import styles from './AuditPage.module.css'

/** Quantas linhas aparecem de uma vez: uma contagem grande não pode travar o celular. */
const PAGE_SIZE = 200

/**
 * Auditoria de estoque: a contagem física de cada produto, ao lado do estoque.
 *
 * Os dois perfis usam. O operador conta na própria loja; o administrador vê as
 * lojas todas da conta e filtra por uma (a regra de quem vê o quê é do banco, ver
 * docs/dominio.md). Cada registro SOMA à contagem do produto, de quem quer que
 * seja: duas pessoas contando o mesmo item chegam ao total certo.
 */
export function AuditPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const scope = useStoreScope('auditoria', isAdmin)
  const list = useAuditList(scope.param)
  const narrow = useMediaQuery('(max-width: 719px)')
  const sort = useSort<AuditRow, AuditSortKey>(list.rows, auditValueOf)
  const totals = useMemo(() => sumAuditTotals(list.rows), [list.rows])

  // Voltar à primeira página quando a busca ou a loja muda: ficar na página 5 de uma
  // lista que agora tem 3 linhas pareceria uma tela vazia. O limite guarda a que
  // busca pertence, em vez de um efeito que o zere.
  const searchKey = `${list.filters.search}|${list.filters.onlyDifferences}|${scope.param}`
  const [page, setPage] = useState({ key: searchKey, limit: PAGE_SIZE })
  const limit = page.key === searchKey ? page.limit : PAGE_SIZE
  const [newOpen, setNewOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [viewing, setViewing] = useState<AuditRow | null>(null)

  // Excluir itens específicos: marca na lista, a barra aparece, e um diálogo confirma.
  const visibleKeys = sort.sortedRows.map(rowKey)
  const selectionState = useSelection(visibleKeys)
  const [deleting, setDeleting] = useState<AuditRow[]>([])

  // Trocar de filtro ou de loja limpa a seleção: um item marcado e depois escondido
  // não pode ser excluído sem a pessoa vê-lo mais (mesma regra do Estoque).
  useEffect(() => {
    selectionState.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.filters, scope.param])

  // O diálogo de registros precisa da versão MAIS NOVA da linha depois de excluir uma parcela.
  const viewingFresh = viewing
    ? (list.all.find((row) => rowKey(row) === rowKey(viewing)) ?? null)
    : null

  // Onde se conta e o que se zera: a loja escolhida no filtro, ou a do próprio login.
  const chosen = scope.stores.find((store) => store.id === scope.filter)
  const targetStoreId = scope.multi ? chosen?.id : undefined
  // Zerar age sobre UMA loja; em "todas as lojas" o botão some, para ninguém apagar a errada.
  const canClear = !scope.multi || chosen !== undefined

  const visible = sort.sortedRows.slice(0, limit)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Auditoria</h1>
          <span className={styles.count}>
            {list.status === 'ready'
              ? `${list.all.length.toLocaleString('pt-BR')} produtos contados`
              : 'carregando…'}
          </span>
        </div>

        <div className={styles.actions}>
          <ExportButton count={list.rows.length} onExport={() => exportAuditRows(list.rows)} />
          {canClear && list.all.length > 0 && (
            <Button variant="secondary" onClick={() => setClearOpen(true)}>
              <TrashIcon width={18} height={18} />
              <span>Zerar auditoria</span>
            </Button>
          )}
          <Button onClick={() => setNewOpen(true)}>
            <PlusIcon width={18} height={18} />
            <span>Adicionar</span>
          </Button>
        </div>
      </header>

      {list.status === 'ready' && list.rows.length > 0 && (
        <TotalTiles
          tiles={[
            { label: 'Valor da falta', value: formatMoney(totals.shortage), hint: 'estoque maior que a contagem' },
            { label: 'Valor da sobra', value: formatMoney(totals.surplus), hint: 'contagem maior que o estoque' },
            { label: 'Diferença líquida', value: formatMoney(totals.net), hint: 'falta menos sobra' },
          ]}
        />
      )}

      <AuditToolbar
        filters={list.filters}
        isFiltered={list.isFiltered}
        shown={list.rows.length}
        total={list.all.length}
        narrow={narrow}
        onSearch={list.setSearch}
        onToggleDifferences={list.setOnlyDifferences}
        onClear={list.clearFilters}
      />

      <StoreFilter scope={scope} />

      <SelectionBar
        selected={selectionState.selection.size}
        total={visibleKeys.length}
        onSelectAll={selectionState.selectAll}
        onClear={selectionState.clear}
        onDelete={() =>
          setDeleting(sort.sortedRows.filter((row) => selectionState.selection.has(rowKey(row))))
        }
      />

      {list.status === 'loading' && <ProductsSkeleton rowHeight={narrow ? 108 : 60} />}
      {list.status === 'error' && <AuditErrorState onRetry={list.reload} />}

      {list.status === 'ready' && list.rows.length === 0 && (
        <AuditEmptyState
          filtered={list.isFiltered && list.all.length > 0}
          onClear={list.clearFilters}
          onAdd={() => setNewOpen(true)}
        />
      )}

      {list.status === 'ready' && list.rows.length > 0 && (
        <>
          <AuditTable
            rows={visible}
            showStore={scope.multi}
            sortKey={sort.sortKey}
            sortDir={sort.sortDir}
            onSort={sort.cycleSort}
            onOpenEntries={setViewing}
            selection={selectionState.selection}
            onToggleSelect={selectionState.toggle}
          />
          {sort.sortedRows.length > limit && (
            <Button variant="secondary" onClick={() => setPage({ key: searchKey, limit: limit + PAGE_SIZE })}>
              Mostrar mais ({(sort.sortedRows.length - limit).toLocaleString('pt-BR')} restantes)
            </Button>
          )}
        </>
      )}

      <NewCountDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSaved={list.reload}
        rows={list.all.filter((row) => !targetStoreId || row.storeId === targetStoreId)}
        storeId={targetStoreId}
        storeName={scope.multi ? (chosen?.name ?? 'a sua loja') : undefined}
      />

      <AuditEntriesDialog row={viewingFresh} onClose={() => setViewing(null)} onChanged={list.reload} />

      <DeleteAuditItemsDialog
        rows={deleting}
        onClose={() => setDeleting([])}
        onDeleted={() => {
          selectionState.clear()
          list.reload()
        }}
      />

      <ClearAuditDialog
        open={clearOpen}
        count={list.all.length}
        storeId={targetStoreId}
        storeName={scope.multi ? chosen?.name : undefined}
        onClose={() => setClearOpen(false)}
        onCleared={list.reload}
      />
    </div>
  )
}
