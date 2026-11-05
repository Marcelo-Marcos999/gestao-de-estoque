import { EyeIcon, EyeOffIcon } from '@/shared/ui/icons'
import styles from './CostToggle.module.css'

/** Liga e desliga a exibição do custo. `aria-pressed` diz o estado a quem não vê o ícone. */
export function CostToggle({ shown, onChange }: { shown: boolean; onChange: (shown: boolean) => void }) {
  return (
    <button type="button" className={styles.toggle} aria-pressed={shown} onClick={() => onChange(!shown)}>
      {shown ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
      <span>{shown ? 'Ocultar custo' : 'Mostrar custo'}</span>
    </button>
  )
}
