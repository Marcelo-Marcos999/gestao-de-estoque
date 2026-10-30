import { ALL_STORES } from '@/shared/lib/stores'
import type { StoreScope } from '@/shared/hooks/useStoreScope'
import { Select } from './Select'
import styles from './StoreFilter.module.css'

/**
 * Escolha de loja do administrador. Só aparece quando há mais de uma loja.
 *
 * É um controle sempre visível (não um chip que some), porque a escolha é
 * lembrada entre sessões: uma lista de uma loja só que parece a da conta
 * inteira é o engano que o filtro restaurado não pode causar (ver CLAUDE.md).
 */
export function StoreFilter({ scope }: { scope: StoreScope }) {
  if (!scope.multi) return null

  return (
    <div className={styles.wrap}>
      <Select
        label="Loja"
        value={scope.filter}
        onChange={(event) => scope.setFilter(event.target.value)}
        options={[
          { value: ALL_STORES, label: 'Todas as lojas' },
          ...scope.stores.map((store) => ({ value: store.id, label: store.name })),
        ]}
      />
    </div>
  )
}
