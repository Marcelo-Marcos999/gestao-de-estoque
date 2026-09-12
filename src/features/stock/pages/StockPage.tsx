import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { UploadIcon } from '@/shared/ui/icons'
import { ProductsSkeleton } from '@/features/products'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { ImportWizard } from '../components/ImportWizard'
import { StockEmptyState, StockErrorState } from '../components/StockEmptyState'
import { StockRowDialog } from '../components/StockRowDialog'
import { StockTable } from '../components/StockTable'
import { StockToolbar } from '../components/StockToolbar'
import { exportStockRows } from '../export'
import { useStockEditor } from '../hooks/useStockEditor'
import { useStockList } from '../hooks/useStockList'
import styles from './StockPage.module.css'

/**
 * Tela de Estoque: saldo, saídas, custo e venda dos produtos, acessível aos
 * dois perfis (ver docs/dominio.md, "de onde vêm saldo e saídas").
 *
 * Diferente do cadastro de produtos, aqui não há "criar" nem "excluir" — só
 * importar a planilha e corrigir os quatro números à mão. Identidade do
 * produto (descrição, código de barras) é só leitura, vinda do cadastro.
 */
export function StockPage() {
  const list = useStockList()
  const isNarrow = useMediaQuery('(max-width: 719px)')
  const focus = useFocusMode()
  const editor = useStockEditor(list.reload)

  const rowHeight = isNarrow ? 108 : 56

  const [importOpen, setImportOpen] = useState(false)

  const acoes = (
    <>
      <ExportButton count={list.rows.length} onExport={() => exportStockRows(list.rows)} />

      <Button variant="secondary" onClick={() => setImportOpen(true)}>
        <UploadIcon width={18} height={18} />
        <span>
          Importar<span className={styles.labelExtra}> planilha</span>
        </span>
      </Button>
    </>
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
        onClear={list.clearFilters}
        onToggleFocus={focus.toggle}
      />

      {list.status === 'loading' && <ProductsSkeleton rowHeight={rowHeight} />}

      {list.status === 'error' && <StockErrorState onRetry={list.reload} />}

      {list.status === 'ready' && list.rows.length === 0 && (
        <StockEmptyState
          filtered={list.isFiltered}
          onClear={list.clearFilters}
          onImport={() => setImportOpen(true)}
        />
      )}

      {list.status === 'ready' && list.rows.length > 0 && (
        <StockTable
          rows={list.rows}
          estimatedRowHeight={rowHeight}
          narrow={isNarrow}
          onEdit={editor.open}
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
    </div>
  )
}
