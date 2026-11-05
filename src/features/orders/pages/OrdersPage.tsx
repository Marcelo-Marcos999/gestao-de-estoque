import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { ProductsSkeleton } from '@/features/products'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useStoreScope } from '@/shared/hooks/useStoreScope'
import { Button } from '@/shared/ui/Button'
import { PlusIcon } from '@/shared/ui/icons'
import { StoreFilter } from '@/shared/ui/StoreFilter'
import { useOrderList } from '../hooks/useOrderList'
import { OrderCard } from '../components/OrderCard'
import { OrderFormDialog } from '../components/OrderFormDialog'
import { OrdersEmptyState, OrdersErrorState } from '../components/OrdersEmptyState'
import { OrdersToolbar } from '../components/OrdersToolbar'
import styles from './OrdersPage.module.css'

/**
 * Pedidos (PD) de clientes: a lista, do mais novo para o mais antigo, e o ponto de
 * partida para criar um.
 *
 * Os dois perfis usam. O operador vê e monta os pedidos da própria loja; o
 * administrador vê os da conta inteira e filtra por loja (a regra de quem vê o quê é
 * do banco, ver docs/dominio.md).
 */
export function OrdersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const scope = useStoreScope('pedidos', isAdmin)
  const list = useOrderList(scope.param)
  const narrow = useMediaQuery('(max-width: 719px)')
  const [newOpen, setNewOpen] = useState(false)

  const chosen = scope.stores.find((store) => store.id === scope.filter)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Pedidos</h1>
          <span className={styles.count}>
            {list.status === 'ready'
              ? `${list.total.toLocaleString('pt-BR')} ${list.total === 1 ? 'pedido' : 'pedidos'}`
              : 'carregando…'}
          </span>
        </div>

        <div className={styles.actions}>
          <Button onClick={() => setNewOpen(true)}>
            <PlusIcon width={18} height={18} />
            <span>Novo pedido</span>
          </Button>
        </div>
      </header>

      <OrdersToolbar
        filters={list.filters}
        isFiltered={list.isFiltered}
        found={list.total}
        onSearch={list.setSearch}
        onStatus={list.setStatus}
        onClear={list.clearFilters}
      />

      <StoreFilter scope={scope} />

      {list.status === 'loading' && <ProductsSkeleton rowHeight={narrow ? 84 : 72} />}
      {list.status === 'error' && <OrdersErrorState onRetry={list.reload} />}

      {list.status === 'ready' && list.orders.length === 0 && (
        <OrdersEmptyState filtered={list.isFiltered} onClear={list.clearFilters} onNew={() => setNewOpen(true)} />
      )}

      {list.status === 'ready' && list.orders.length > 0 && (
        <>
          <ul className={styles.list}>
            {list.orders.map((order) => (
              <OrderCard key={order.id} order={order} showStore={scope.multi} />
            ))}
          </ul>
          {list.total > list.orders.length && (
            <Button variant="secondary" onClick={list.showMore}>
              Mostrar mais ({(list.total - list.orders.length).toLocaleString('pt-BR')} restantes)
            </Button>
          )}
        </>
      )}

      <OrderFormDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        stores={scope.multi ? scope.stores : undefined}
        defaultStoreId={chosen?.id}
        // Pedido novo já abre na própria tela, pronto para receber o primeiro item.
        onSaved={(order) => navigate(`/pedidos/${order.id}`, { state: { addItem: true } })}
      />
    </div>
  )
}
