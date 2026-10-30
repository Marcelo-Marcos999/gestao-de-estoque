import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import styles from './ReviewParts.module.css'

export interface ReviewTile {
  /** Quantas linhas caem neste bloco. */
  value: number
  caption: string
  /** Só a cor do número; o texto do bloco carrega o significado. */
  tone: 'ok' | 'warning' | 'bad' | 'neutral'
}

/** Os números da revisão: quanto entra, quanto é pulado e por quê. */
export function ReviewTiles({ tiles }: { tiles: ReviewTile[] }) {
  return (
    <div className={styles.summary}>
      {tiles.map((tile) => (
        <div className={`${styles.tile} ${styles[tile.tone]}`} key={tile.caption}>
          <span className={styles.value}>{tile.value.toLocaleString('pt-BR')}</span>
          <span className={styles.caption}>{tile.caption}</span>
        </div>
      ))}
    </div>
  )
}

/** Escolhas da revisão (ex.: origem padrão), acima dos números que elas mudam. */
export function ReviewOptions({ children }: { children: ReactNode }) {
  return <div className={styles.options}>{children}</div>
}

export interface PreviewRow {
  line: number
  label: string
  /** Texto do selo: o motivo de a linha entrar ou ser pulada. */
  note: string
  tone: BadgeTone
  /** Linhas com problema vão na frente. */
  problem: boolean
}

/**
 * Primeiras linhas já classificadas, com o que exige atenção na frente: numa
 * planilha de milhares de linhas, ninguém vai rolar até achar o erro.
 */
export function ReviewPreview({ rows, total }: { rows: PreviewRow[]; total: number }) {
  const shown = useMemo(
    () => [...rows.filter((r) => r.problem), ...rows.filter((r) => !r.problem)].slice(0, 60),
    [rows],
  )
  const hasProblem = rows.some((r) => r.problem)

  return (
    <>
      <p className={styles.previewTitle}>
        {hasProblem ? 'Linhas que precisam de atenção, seguidas das demais' : 'Primeiras linhas da planilha'}
      </p>

      <div className={styles.preview}>
        {shown.map((row) => (
          <div className={styles.row} key={row.line}>
            <span className={styles.line}>L{row.line}</span>
            <span className={styles.label} title={row.label}>
              {row.label || <em>sem identificação</em>}
            </span>
            <Badge tone={row.tone}>{row.note}</Badge>
          </div>
        ))}

        {total > shown.length && (
          <p className={styles.more}>e mais {(total - shown.length).toLocaleString('pt-BR')} linhas</p>
        )}
      </div>
    </>
  )
}
