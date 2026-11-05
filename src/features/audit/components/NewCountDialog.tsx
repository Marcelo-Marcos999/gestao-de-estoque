import { useState } from 'react'
import type { FormEvent } from 'react'
import { ProductPicker, type ChosenProduct } from '@/features/products'
import { limitMessage } from '@/shared/lib/limits'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { addCount } from '../api'
import type { AuditRow } from '../types'
import styles from './NewCountDialog.module.css'

interface NewCountDialogProps {
  open: boolean
  onClose: () => void
  /** A lista atrás do diálogo precisa reler: o registro entrou. */
  onSaved: () => void
  /** Linhas já contadas na loja de destino, para mostrar o que o registro vai somar. */
  rows: AuditRow[]
  /** A loja onde se conta, quando não é a do próprio login (administrador). */
  storeId?: string
  /** Só com mais de uma loja à vista: deixa claro EM QUAL se está contando. */
  storeName?: string
}

/**
 * Registra uma contagem.
 *
 * Depois de salvar o diálogo NÃO fecha: quem audita registra dezenas de produtos
 * em sequência, e reabrir a janela a cada um dobraria o trabalho. Ele limpa os
 * campos, confirma o que entrou e volta ao campo de busca; "Concluir" fecha.
 */
export function NewCountDialog({ open, ...rest }: NewCountDialogProps) {
  if (!open) return null
  return <Form {...rest} />
}

/** A quantidade que já vem preenchida; a pessoa altera se precisar. */
const DEFAULT_QUANTITY = '1'

function Form({ onClose, onSaved, rows, storeId, storeName }: Omit<NewCountDialogProps, 'open'>) {
  const [product, setProduct] = useState<ChosenProduct | null>(null)
  // Texto: um campo numérico controlado não deixa apagar para digitar outro valor.
  // Nasce em 1: quem audita conta um item de cada vez na maioria dos casos (ou lê o
  // código de barras de cada unidade), então o padrão é o que dispensa digitar.
  const [quantity, setQuantity] = useState(DEFAULT_QUANTITY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // Remonta o seletor depois de cada registro, devolvendo o foco à busca.
  const [round, setRound] = useState(0)

  const already = product ? rows.find((row) => row.productId === product.productId) : undefined
  const parsed = quantity.trim() === '' ? null : Number(quantity)
  const valid = parsed !== null && Number.isInteger(parsed) && parsed >= 0

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!product) return setError('Escolha o produto.')
    if (!valid) return setError('Informe a quantidade contada: 0 ou mais, sem casas decimais.')

    setSaving(true)
    setError(null)
    try {
      const total = await addCount(product.productId, parsed, storeId)
      setDone(`${product.description || `SKU ${product.sku}`}: contagem agora em ${total}.`)
      setProduct(null)
      setQuantity(DEFAULT_QUANTITY)
      setRound((current) => current + 1)
      onSaved()
    } catch (erro) {
      setError(limitMessage(erro) ?? 'Não foi possível registrar. Verifique a conexão e tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Adicionar contagem"
      subtitle={storeName ? `Contando em ${storeName}.` : 'Conte o produto na prateleira e registre aqui.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Concluir
          </Button>
          <Button type="submit" form="audit-count-form" loading={saving}>
            Registrar contagem
          </Button>
        </>
      }
    >
      <form className={styles.form} id="audit-count-form" onSubmit={(e) => void save(e)} noValidate>
        {done && <Alert tone="success">{done}</Alert>}

        <div className={styles.field}>
          <span className={styles.label}>Produto</span>
          {/* Sem pendente: a contagem se compara com o estoque do produto, e um
              produto fora do cadastro não teria com o que comparar. */}
          <ProductPicker
            key={round}
            chosen={product}
            allowPending={false}
            onChoose={(chosen) => {
              setProduct(chosen)
              setError(null)
              setDone(null)
            }}
            onDescriptionChange={() => {}}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="audit-quantity">
            Quantidade contada
          </label>
          <input
            id="audit-quantity"
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={quantity}
            // Seleciona o "1" ao entrar no campo: quem quer 10 digita 10, em vez de
            // acabar com 110 por escrever depois do valor que já estava lá.
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              setQuantity(event.target.value)
              setError(null)
            }}
            placeholder="1"
          />
          {/* O que este registro vai fazer, antes de apertar: soma, não substitui. */}
          {product && valid && (
            <span className={styles.hint}>
              {already
                ? `Já contado: ${already.counted}. Com este registro: ${already.counted + parsed}.`
                : `Primeiro registro deste produto: contagem ${parsed}.`}
            </span>
          )}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Dialog>
  )
}
