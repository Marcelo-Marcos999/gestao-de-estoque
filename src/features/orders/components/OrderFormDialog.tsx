import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@/features/auth'
import { limitMessage } from '@/shared/lib/limits'
import type { StoreOption } from '@/shared/lib/stores'
import { formatPhone, isValidPhone, phoneDigits } from '@/shared/lib/phone'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { createOrder, updateOrder } from '../api'
import type { Order } from '../types'

interface OrderFormDialogProps {
  open: boolean
  onClose: () => void
  /** Presente: corrige o cliente e a observação deste pedido. Ausente: cria um pedido novo. */
  order?: Order
  /** Administrador com mais de uma loja: escolhe em qual loja o pedido nasce. */
  stores?: StoreOption[]
  /** A loja que o filtro da tela já escolheu, quando há uma. */
  defaultStoreId?: string
  onSaved: (order: Order) => void
}

/** Cria o pedido (só o cliente: os itens vêm na tela do pedido) ou corrige esses dados. */
export function OrderFormDialog({ open, ...rest }: OrderFormDialogProps) {
  if (!open) return null
  return <Form {...rest} />
}

function Form({ onClose, order, stores, defaultStoreId, onSaved }: Omit<OrderFormDialogProps, 'open'>) {
  const { user } = useAuth()
  const [customer, setCustomer] = useState(order?.customer ?? '')
  // Guardado já com a máscara, para o campo mostrar "(11) 98765-4321" enquanto se digita.
  const [phone, setPhone] = useState(formatPhone(order?.phone ?? ''))
  const [note, setNote] = useState(order?.note ?? '')
  // Sem loja escolhida no filtro, a do próprio login: é onde o administrador vende por padrão.
  const [storeId, setStoreId] = useState(defaultStoreId ?? user?.id ?? stores?.[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chooseStore = !order && stores !== undefined && stores.length > 1

  async function save(event: FormEvent) {
    event.preventDefault()
    if (customer.trim() === '') return setError('Informe o nome do cliente.')
    if (!isValidPhone(phone)) return setError('Telefone incompleto: informe o DDD e o número, ou deixe em branco.')

    setSaving(true)
    setError(null)
    try {
      const saved = order
        ? await updateOrder(order.id, customer.trim(), phoneDigits(phone), note.trim())
        : await createOrder(customer.trim(), phoneDigits(phone), note.trim(), chooseStore ? storeId : undefined)
      onSaved(saved)
      onClose()
    } catch (erro) {
      setError(limitMessage(erro) ?? 'Não foi possível salvar o pedido. Verifique a conexão e tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={order ? `Editar PD ${order.number}` : 'Novo pedido'}
      subtitle={order ? undefined : 'Informe o cliente. Os produtos você adiciona em seguida.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="order-form" loading={saving}>
            {order ? 'Salvar' : 'Criar pedido'}
          </Button>
        </>
      }
    >
      <form id="order-form" onSubmit={(e) => void save(e)} noValidate style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        {chooseStore && stores && (
          <Select
            label="Loja do pedido"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            options={stores.map((store) => ({ value: store.id, label: store.name }))}
          />
        )}
        <TextField
          label="Cliente"
          value={customer}
          onChange={(event) => setCustomer(event.target.value)}
          maxLength={120}
          autoComplete="off"
          autoFocus
        />
        <TextField
          label="Telefone"
          hint="Com DDD. Na tela do pedido vira um toque para ligar ou chamar no WhatsApp."
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(formatPhone(event.target.value))}
          placeholder="(11) 98765-4321"
          autoComplete="off"
          optional
        />
        <TextField
          label="Observação"
          hint="Entrega, forma de pagamento… o que o vendedor precisa lembrar."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          autoComplete="off"
          optional
        />
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Dialog>
  )
}
