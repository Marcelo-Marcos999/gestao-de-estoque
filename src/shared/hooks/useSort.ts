import { useCallback, useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

interface SortState<Key extends string> {
  key: Key
  dir: SortDir
}

/**
 * Ordenação de tabela, genérica por chave de coluna.
 *
 * Um clique no cabeçalho cicla três estados — crescente, decrescente, sem
 * ordenação — porque a ordem original (a que a busca já trouxe) também é um
 * estado válido de se voltar, não só um ponto de partida.
 *
 * `valueOf` isola o "como comparar" de cada coluna; a mecânica do ciclo e da
 * comparação fica aqui, uma vez só, para toda tela com registros reusar (ver
 * CLAUDE.md — lógica repetida vira módulo em `shared/`).
 */
export function useSort<Row, Key extends string>(
  rows: Row[],
  valueOf: (row: Row, key: Key) => string | number,
) {
  const [state, setState] = useState<SortState<Key> | null>(null)

  const cycleSort = useCallback((key: Key) => {
    setState((current) => {
      if (!current || current.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }, [])

  const sortedRows = useMemo(() => {
    if (!state) return rows

    const { key, dir } = state
    const sign = dir === 'asc' ? 1 : -1

    // Guarda o índice original para desempatar: sem isso, dois valores iguais
    // trocariam de lugar entre uma ordenação e outra sem motivo nenhum.
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const av = valueOf(a.row, key)
        const bv = valueOf(b.row, key)
        if (av < bv) return -1 * sign
        if (av > bv) return 1 * sign
        return a.index - b.index
      })
      .map(({ row }) => row)
  }, [rows, state, valueOf])

  return {
    sortKey: state?.key ?? null,
    sortDir: state?.dir ?? null,
    cycleSort,
    sortedRows,
  }
}
