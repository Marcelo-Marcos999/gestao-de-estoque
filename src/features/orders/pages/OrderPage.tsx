import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { ApiError } from '@/shared/lib/http'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ArrowLeftIcon, EditIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'
import { closeOrder, deleteOrder, removeLine, reopenOrder } from '../api'
import { CostToggle } from '../components/CostToggle'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { OrderFormDialog } from '../components/OrderFormDialog'
import { OrderItemDialog } from '../components/OrderItemDialog'
import { OrderLines } from '../components/OrderLines'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { OrderActionBar, OrderSummary } from '../components/OrderTotals'
import { formatWhen } from '../format'
import { useOrder } from '../hooks/useOrder'
import { useShowCost } from '../hooks/useShowCost'
import type { Order, OrderLine } from '../types'
import styles from './OrderPage.module.css'

/**
 * Um pedido: os itens, o total e as ações (adicionar, editar, fechar, reabrir).
 *
 * Pedido ABERTO aceita mudar os itens; FECHADO é só leitura até ser reaberto. A
 * regra é do servidor — a tela só não oferece o que ele recusaria.
 */
export function OrderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { order, status, setOrder, reload } = useOrder(id)
  const [showCost, setShowCost] = useShowCost()

  // Vindo de "Novo pedido", já abre o diálogo do primeiro item.
  const [itemOpen, setItemOpen] = useState((location.state as { addItem?: boolean } | null)?.addItem === true)
  const [editingLine, setEditingLine] = useState<OrderLine | null>(null)
  const [removing, setRemoving] = useState<OrderLine | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recarregar a página não pode reabrir o diálogo: o aviso de "pedido novo" vale uma vez.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  if (status === 'loading') return <div className={styles.page} aria-busy="true" />

  if (status !== 'ready' || !order) {
    return (
      <div className={styles.page}>
        <BackLink />
        <div className={styles.notice} role="alert">
          <p className={styles.noticeTitle}>
            {status === 'notFound' ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}
          </p>
          <p className={styles.noticeText}>
            {status === 'notFound'
              ? 'Ele pode ter sido excluído, ou ser de outra loja.'
              : 'Verifique a conexão e tente de novo.'}
          </p>
          {status === 'error' && (
            <Button variant="secondary" onClick={reload}>
              Tentar de novo
            </Button>
          )}
        </div>
      </div>
    )
  }

  const open = order.status === 'open'

  /** Fechar e reabrir: o servidor devolve o pedido já no novo estado. */
  async function change(action: (orderId: string) => Promise<Order>, fallback: string) {
    if (!order) return
    setBusy(true)
    setError(null)
    try {
      setOrder(await action(order.id))
    } catch (erro) {
      setError(erro instanceof ApiError && erro.codigo === 'pedido_vazio' ? 'Adicione ao menos um item antes de fechar o pedido.' : fallback)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <BackLink />

      <header className={styles.header}>
        <div className={styles.titles}>
          <div className={styles.heading}>
            <h1 className={styles.title}>PD {order.number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <span className={styles.customer}>{order.customer}</span>
          <span className={styles.meta}>
            Aberto em {formatWhen(order.createdAt)} por {order.by}
            {/* O nome da loja só ajuda ao administrador, e só quando difere de quem montou. */}
            {user?.role === 'admin' && order.storeName !== order.by && ` · ${order.storeName}`}
          </span>
          {order.note && <span className={styles.note}>{order.note}</span>}
        </div>

        {open && (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <EditIcon width={18} height={18} />
              <span>Editar cliente</span>
            </Button>
            <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
              <TrashIcon width={18} height={18} />
              <span>Excluir pedido</span>
            </Button>
          </div>
        )}
      </header>

      {!open && (
        <Alert tone="info">Pedido fechado: para mudar os itens, reabra o pedido no rodapé da tela.</Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <section className={styles.items} aria-label="Itens do pedido">
        <div className={styles.itemsHeader}>
          <h2 className={styles.itemsTitle}>Itens</h2>
          <div className={styles.itemsActions}>
            <CostToggle shown={showCost} onChange={setShowCost} />
            {open && (
              <Button onClick={() => setItemOpen(true)}>
                <PlusIcon width={18} height={18} />
                <span>Adicionar item</span>
              </Button>
            )}
          </div>
        </div>

        {order.lines.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.noticeTitle}>Nenhum item ainda</p>
            <p className={styles.noticeText}>
              Busque o produto pelo código ou pela descrição: o preço e o saldo vêm do estoque da loja.
            </p>
          </div>
        ) : (
          <OrderLines
            lines={order.lines}
            editable={open}
            showCost={showCost}
            onEdit={setEditingLine}
            onRemove={setRemoving}
          />
        )}
      </section>

      {order.lines.length > 0 && <OrderSummary order={order} showCost={showCost} />}

      <OrderActionBar
        order={order}
        busy={busy}
        onClose={() => void change(closeOrder, 'Não foi possível fechar o pedido. Tente de novo.')}
        onReopen={() => void change(reopenOrder, 'Não foi possível reabrir o pedido. Tente de novo.')}
      />

      <OrderItemDialog open={itemOpen} onClose={() => setItemOpen(false)} order={order} onSaved={setOrder} />
      <OrderItemDialog
        open={editingLine !== null}
        onClose={() => setEditingLine(null)}
        order={order}
        line={editingLine ?? undefined}
        onSaved={setOrder}
      />
      <OrderFormDialog open={editOpen} onClose={() => setEditOpen(false)} order={order} onSaved={setOrder} />

      <ConfirmDialog
        open={removing !== null}
        title="Excluir item"
        text={`Tirar "${removing?.description ?? ''}" do pedido? O total é recalculado.`}
        confirmLabel="Excluir item"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) setOrder(await removeLine(order.id, removing.id))
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir pedido"
        text={`Excluir o PD ${order.number} de ${order.customer}, com ${order.itemCount} ${order.itemCount === 1 ? 'item' : 'itens'}? Não dá para desfazer.`}
        confirmLabel="Excluir pedido"
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteOrder(order.id)
          navigate('/pedidos', { replace: true })
        }}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/pedidos" className={styles.back}>
      <ArrowLeftIcon width={18} height={18} />
      <span>Pedidos</span>
    </Link>
  )
}
