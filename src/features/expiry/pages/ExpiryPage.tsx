import { useState } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ExportButton } from '@/shared/ui/ExportButton'
import { UndoBar } from '@/shared/ui/UndoBar'
import { LossRecordDialog } from '@/features/breakage'
import { ProductsSkeleton } from '@/features/products'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useFocusMode } from '@/shared/hooks/useLayoutPreferences'
import { PAGE_SCROLLER_ATTR } from '@/shared/hooks/useListVirtualizer'
import { FocusToggle } from '@/shared/ui/FocusToggle'
import { ScanButton } from '@/shared/ui/ScanButton'
import { PlusIcon, SearchIcon } from '@/shared/ui/icons'
import { SITUATIONS } from '../situation'
import { ExpiryEmptyState } from '../components/ExpiryEmptyState'
import { ExpiryTable } from '../components/ExpiryTable'
import { NewExpiryDialog } from '../components/NewExpiryDialog'
import { PeriodField } from '../components/PeriodField'
import { SituationTiles } from '../components/SituationTiles'
import { ExpiryDialog } from '../components/ExpiryDialog'
import { exportExpiryRows } from '../export'
import { useExpiryEditor } from '../hooks/useExpiryEditor'
import { useExpiryList } from '../hooks/useExpiryList'
import { useGenerateBreakage } from '../hooks/useGenerateBreakage'
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
  const rowHeight = isNarrow ? 128 : 62

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

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            className={styles.input}
            type="search"
            value={list.filters.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder={
              isNarrow ? 'Buscar produto' : 'Buscar por descrição, SKU ou código de barras'
            }
            aria-label="Buscar lotes"
            autoComplete="off"
          />

          {/* A busca aceita o código lido, não só o digitado: no corredor a
              etiqueta está na mão e o teclado do celular não. */}
          <ScanButton onDetect={list.setSearch} label="Buscar por código de barras" />
        </div>

        {/* O número que sustenta a previsão fica visível e editável aqui: sem
            ele, "sai em 195 dias" é um número sem procedência — e quem lê a
            previsão é quem percebe que o intervalo está errado. */}
        <PeriodField days={list.periodDays} onChange={list.setPeriodDays} />

        {focus.focused && <div className={styles.actions}>{acoes}</div>}

        <FocusToggle
          focused={focus.focused}
          available={focus.available}
          onToggle={focus.toggle}
        />
      </div>

      {list.isFiltered && (
        <div className={styles.active} role="status">
          <SearchIcon className={styles.activeIcon} width={16} height={16} />
          <span className={styles.activeText}>
            Mostrando {list.matching.toLocaleString('pt-BR')}{' '}
            {list.matching === 1 ? 'lote' : 'lotes'}
            {list.filters.situations.length > 0 && (
              <>
                {' '}
                em{' '}
                {list.filters.situations
                  .map((s) => SITUATIONS[s].label.toLowerCase())
                  .join(', ')}
              </>
            )}
            {list.filters.search.trim() && (
              <>
                {' '}
                para <span className={styles.term}>“{list.filters.search.trim()}”</span>
              </>
            )}
            .
          </span>
          <Button variant="secondary" onClick={list.clearFilters}>
            Limpar filtros
          </Button>
        </div>
      )}

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
          rows={list.rows}
          estimatedRowHeight={rowHeight}
          narrow={isNarrow}
          onEdit={editor.open}
          onGenerateBreakage={breakage.open}
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
