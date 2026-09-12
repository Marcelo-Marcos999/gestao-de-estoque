import { useState } from 'react'
import { ProductPicker, type ChosenProduct } from '@/features/products'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { daysUntil, parseDate, type IsoDate } from '@/shared/lib/date'
import { ensureExpiryItem } from '../api'
import styles from './NewExpiryDialog.module.css'

interface NewExpiryDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

/**
 * Põe um lote em acompanhamento à mão.
 *
 * Até aqui um lote só nascia da base de demonstração ou como efeito de um
 * registro de quebra com validade — quem encontrava uma caixa no corredor e
 * queria só acompanhar a data não tinha por onde começar, e era obrigado a
 * apontar uma perda que não houve.
 *
 * Os dois perfis criam: a validade é o dado operacional que o app existe para
 * acompanhar, e quem acha a caixa é quem sabe a data (ver docs/dominio.md).
 */
export function NewExpiryDialog({ open, onClose, onCreated }: NewExpiryDialogProps) {
  // Montar só quando aberto zera os campos a cada abertura, sem um efeito
  // sincronizando prop com estado.
  if (!open) return null
  return <Form onClose={onClose} onCreated={onCreated} />
}

function Form({ onClose, onCreated }: Omit<NewExpiryDialogProps, 'open'>) {
  const [product, setProduct] = useState<ChosenProduct | null>(null)
  const [expiryDate, setExpiryDate] = useState<IsoDate | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const restantes = daysUntil(expiryDate)

  async function salvar() {
    if (!product) {
      setErro('Escolha o produto.')
      return
    }
    if (!expiryDate) {
      setErro('Informe a validade: um lote é o produto mais a data.')
      return
    }

    setSaving(true)
    const criou = await ensureExpiryItem(product.productId, expiryDate)
    setSaving(false)

    // Lote repetido não é erro nem duplicata nova: é o mesmo lote, e dizer
    // isso é melhor que fechar o diálogo deixando a lista igual.
    if (!criou) {
      setErro('Este produto já está em acompanhamento nesta validade.')
      return
    }

    onCreated()
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Novo lote"
      subtitle="Acompanhe a validade de um produto que já está no cadastro."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} loading={saving}>
            Acompanhar
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.label}>Produto</span>
          {/* Sem pendente aqui: um lote órfão não apareceria na própria lista
              que ele deveria alimentar (ver ProductPicker). */}
          <ProductPicker
            chosen={product}
            allowPending={false}
            onChoose={(escolhido) => {
              setProduct(escolhido)
              setErro(null)
            }}
            onDescriptionChange={() => {}}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-expiry-date">
            Validade do lote
          </label>
          <input
            id="new-expiry-date"
            className={styles.input}
            type="date"
            value={expiryDate ?? ''}
            onChange={(event) => {
              setExpiryDate(parseDate(event.target.value))
              setErro(null)
            }}
          />
          {restantes !== null && (
            <span className={`${styles.hint} ${restantes < 0 ? styles.overdue : ''}`}>
              {restantes < 0
                ? `venceu há ${Math.abs(restantes)} dias`
                : restantes === 0
                  ? 'vence hoje'
                  : `vence em ${restantes} dias`}
            </span>
          )}
        </div>

        {erro && <Alert tone="danger">{erro}</Alert>}

        <Alert tone="info">
          Saldo e saídas são do produto e continuam vindo da tela de Estoque.
          Aqui entra só a data que este lote carrega.
        </Alert>
      </div>
    </Dialog>
  )
}
