import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { PlusIcon, UploadIcon } from '@/shared/ui/icons'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { useAuth } from '@/features/auth'
import { ImportWizard } from '../components/ImportWizard'
import { ProductFormDialog } from '../components/ProductFormDialog'
import { ProductsEmptyState, ProductsErrorState } from '../components/ProductsEmptyState'
import { ProductsSkeleton } from '../components/ProductsSkeleton'
import { ProductsTable } from '../components/ProductsTable'
import { ProductsToolbar } from '../components/ProductsToolbar'
import { exportProducts } from '../export'
import { useProductList } from '../hooks/useProductList'
import type { Product } from '../types'
import styles from './ProductsPage.module.css'

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

  // O cadastro é a base que todo registro de quebra consulta, então todos
  // leem. Só o administrador alimenta (ver CLAUDE.md, "Perfis de acesso").
  // Esconder a ação é melhor que bloqueá-la no clique: assim o operador não
  // descobre que não pode só depois de preencher um formulário inteiro.
  const { user } = useAuth()
  const podeEditar = user?.role === 'admin'

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
        onClear={list.clearFilters}
        onToggleFocus={focus.toggle}
      />

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
          products={list.products}
          // Sem permissão de escrita a linha não oferece edição.
          onEdit={podeEditar ? (product) => openForm(product) : undefined}
          estimatedRowHeight={rowHeight}
          narrow={isNarrow}
        />
      )}

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
