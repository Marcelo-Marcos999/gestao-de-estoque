import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { SelectionBar } from '@/shared/ui/SelectionBar'
import { UndoBar } from '@/shared/ui/UndoBar'
import { PlusIcon, UploadIcon } from '@/shared/ui/icons'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { useSelection } from '@/shared/hooks/useSelection'
import { useSort } from '@/shared/hooks/useSort'
import { useAuth } from '@/features/auth'
import { ImportWizard } from '../components/ImportWizard'
import { ProductFormDialog } from '../components/ProductFormDialog'
import { ProductsEmptyState, ProductsErrorState } from '../components/ProductsEmptyState'
import { ProductsSkeleton } from '../components/ProductsSkeleton'
import { ProductsTable, type ProductSortKey } from '../components/ProductsTable'
import { ProductsToolbar } from '../components/ProductsToolbar'
import { exportProducts } from '../export'
import { useProductDeletion } from '../hooks/useProductDeletion'
import { useProductList } from '../hooks/useProductList'
import type { Product } from '../types'
import styles from './ProductsPage.module.css'

/** O que cada coluna ordenável compara. */
function productValueOf(product: Product, key: ProductSortKey): string | number {
  switch (key) {
    case 'barcode':
      return product.barcode
    case 'sku':
      return product.sku
    case 'description':
      return product.description
  }
}

/**
 * Tela do cadastro de produtos.
 *
 * Só compõe: a busca dos dados e o estado dos filtros vivem em
 * `useProductList`, e cada pedaço visual é um componente à parte. O que sobra
 * aqui é decidir qual dos quatro estados aparece — carregando, erro, vazio ou
 * lista — e quais diálogos estão abertos.
 */
export function ProductsPage() {
  const list = useProductList()
  const isNarrow = useMediaQuery('(max-width: 719px)')
  const focus = useFocusMode()
  const sort = useSort<Product, ProductSortKey>(list.products, productValueOf)

  // O cadastro é a base que todo registro de quebra consulta, então todos
  // leem. Só o administrador alimenta (ver CLAUDE.md, "Perfis de acesso").
  // Esconder a ação é melhor que bloqueá-la no clique: assim o operador não
  // descobre que não pode só depois de preencher um formulário inteiro.
  const { user } = useAuth()
  const podeEditar = user?.role === 'admin'

  const visibleIds = sort.sortedRows.map((product) => product.id)
  const selectionState = useSelection(visibleIds)
  const deletion = useProductDeletion(list.reload)

  // Trocar de filtro limpa a seleção: marcar produtos numa busca e excluir
  // depois de trocar o termo apagaria produtos que a pessoa não está vendo
  // mais — o pior tipo de exclusão em massa (mesma regra da Quebra).
  useEffect(() => {
    selectionState.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.filters])

  function deleteSelected() {
    const ids = [...selectionState.selection]
    selectionState.clear()
    void deletion.removeItems(ids)
  }

  // Altura provável de uma linha, usada pelo esqueleto de carregamento e como
  // estimativa inicial da lista virtualizada. No celular a linha é mais alta
  // porque o nome do produto quebra em várias linhas.
  const rowHeight = isNarrow ? 118 : 52

  const [editing, setEditing] = useState<Product | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  /** `null` abre o formulário em branco; um produto abre em edição. */
  function openForm(product: Product | null) {
    setEditing(product)
    setFormOpen(true)
  }

  /**
   * As ações acompanham o cabeçalho quando ele existe e migram para a barra de
   * busca no modo foco — escondê-las junto com o título deixaria o modo foco
   * sem saída para quem precisa cadastrar.
   */
  const acoes = (
    <>
      {/* Exportar é leitura, então fica fora do bloco do administrador. */}
      <ExportButton count={list.products.length} onExport={() => exportProducts(list.products)} />

      {podeEditar && (
        <>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <UploadIcon width={18} height={18} />
            {/* Rótulo em um único elemento: como o botão é flex, deixar a
                palavra extra como irmã do texto faria o gap somar ao espaço. */}
            <span>
              Importar<span className={styles.labelExtra}> planilha</span>
            </span>
          </Button>
          <Button onClick={() => openForm(null)}>
            <PlusIcon width={18} height={18} />
            <span>
              Novo<span className={styles.labelExtra}> produto</span>
            </span>
          </Button>
        </>
      )}
    </>
  )

  return (
    <div className={styles.page} {...{ [PAGE_SCROLLER_ATTR]: '' }}>
      {!focus.focused && (
        <header className={styles.header}>
          <div className={styles.titles}>
            <h1 className={styles.title}>Cadastro de produtos</h1>
            <span className={styles.count}>
              {list.status === 'ready'
                ? `${list.total.toLocaleString('pt-BR')} produtos cadastrados`
                : 'carregando…'}
            </span>
          </div>

          <div className={styles.actions}>{acoes}</div>
        </header>
      )}

      <ProductsToolbar
        filters={list.filters}
        isFiltered={list.isFiltered}
        matching={list.matching}
        narrow={isNarrow}
        focused={focus.focused}
        focusAvailable={focus.available}
        actions={focus.focused ? acoes : null}
        onSearch={list.setSearch}
        onToggleWithoutBarcode={list.setOnlyWithoutBarcode}
        onTogglePending={list.setOnlyPending}
        onRangeChange={list.setNumberRange}
        onClearRanges={list.clearRanges}
        onClear={list.clearFilters}
        onToggleFocus={focus.toggle}
      />

      {podeEditar && (
        <SelectionBar
          selected={selectionState.selection.size}
          total={visibleIds.length}
          onSelectAll={selectionState.selectAll}
          onClear={selectionState.clear}
          onDelete={deleteSelected}
        />
      )}

      {/* Os quatro estados de uma tela que busca dados. Nenhum pode faltar:
          sem o de erro, uma falha de rede deixaria a tela em branco sem
          explicação. */}
      {list.status === 'loading' && <ProductsSkeleton rowHeight={rowHeight} />}

      {list.status === 'error' && <ProductsErrorState onRetry={list.reload} />}

      {list.status === 'ready' && list.products.length === 0 && (
        <ProductsEmptyState
          filtered={list.isFiltered}
          podeImportar={podeEditar}
          onClear={list.clearFilters}
          onImport={() => setImportOpen(true)}
        />
      )}

      {list.status === 'ready' && list.products.length > 0 && (
        <ProductsTable
          products={sort.sortedRows}
          // Sem permissão de escrita a linha não oferece edição, seleção nem exclusão.
          onEdit={podeEditar ? (product) => openForm(product) : undefined}
          onDelete={podeEditar ? (product) => void deletion.removeItems([product.id]) : undefined}
          selection={podeEditar ? selectionState.selection : undefined}
          onToggleSelect={podeEditar ? selectionState.toggle : undefined}
          estimatedRowHeight={rowHeight}
          narrow={isNarrow}
          sortKey={sort.sortKey}
          sortDir={sort.sortDir}
          onSort={sort.cycleSort}
        />
      )}

      <UndoBar
        count={deletion.undoable.length}
        label="Produto"
        plural="produtos"
        onUndo={() => void deletion.undo()}
        onDismiss={deletion.dismissUndo}
      />

      <ProductFormDialog
        open={formOpen && podeEditar}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSaved={list.reload}
      />

      <ImportWizard
        open={importOpen && podeEditar}
        onClose={() => setImportOpen(false)}
        onImported={list.reload}
      />
    </div>
  )
}
