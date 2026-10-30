import styles from './TotalTiles.module.css'

export interface TotalTile {
  label: string
  /** Já formatado (dinheiro, quantidade): o cartão só mostra. */
  value: string
  /** Linha de apoio sob o número — o que ele soma, ou o que ficou de fora. */
  hint?: string
}

/**
 * Os totais do topo de uma lista: números grandes, só informativos.
 *
 * Sem clique, diferente dos cartões de situação das Validades, porque não há uma
 * segunda faixa para filtrar por trás do número — é o mesmo total que a lista
 * abaixo já mostra, resumido. Compartilhado por Estoque, Validades e Quebra para
 * que os três tenham o mesmo desenho.
 */
export function TotalTiles({ tiles }: { tiles: TotalTile[] }) {
  return (
    <div className={styles.tiles}>
      {tiles.map((tile) => (
        <div className={styles.tile} key={tile.label}>
          <span className={styles.label}>{tile.label}</span>
          <span className={styles.value}>{tile.value}</span>
          {tile.hint && <span className={styles.hint}>{tile.hint}</span>}
        </div>
      ))}
    </div>
  )
}
