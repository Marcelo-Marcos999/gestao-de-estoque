import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeTone =
  | 'novo'
  | 'existente'
  | 'duplicado'
  | 'invalido'
  | 'neutro'
  | 'marca'
  | 'atualiza'
  | 'pendente'

/**
 * Etiqueta curta de estado, usada na revisão da importação.
 *
 * O texto vem sempre junto da cor: quem não distingue vermelho de verde, ou
 * está com o celular sob sol forte, ainda lê "Novo" ou "Já cadastrado".
 */
export function Badge({ tone = 'neutro', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
