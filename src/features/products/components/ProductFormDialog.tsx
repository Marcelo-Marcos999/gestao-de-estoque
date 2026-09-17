import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { TextField } from '@/shared/ui/TextField'
import { digitsOnly } from '@/shared/lib/cell'
import { createProduct, deleteProducts, updateProduct } from '../api'
import type { Product, ProductDraft } from '../types'
import styles from './ProductFormDialog.module.css'

interface ProductFormDialogProps {
  open: boolean
  /** null cria um produto novo; um produto abre em edição. */
  product: Product | null
  onClose: () => void
  onSaved: () => void
}

const EMPTY: ProductDraft = { sku: '', description: '', barcode: '' }

interface FieldErrors {
  sku?: string
  description?: string
  barcode?: string
}

const SAVE_MESSAGES = {
  sku_duplicado: 'Já existe um produto com esse código SKU.',
  barras_duplicado: 'Esse código de barras já está em outro produto.',
} as const

/**
 * Só existe enquanto aberto, e é remontado a cada produto diferente.
 *
 * Assim o estado do formulário nasce direto dos dados do produto, em vez de
 * um efeito "limpar tudo" rodando depois que a tela já apareceu com o
 * conteúdo do produto anterior.
 */
export function ProductFormDialog({ open, product, onClose, onSaved }: ProductFormDialogProps) {
  if (!open) return null

  return (
    <ProductForm
      key={product?.id ?? 'novo'}
      product={product}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

type ProductFormProps = Omit<ProductFormDialogProps, 'open'>

function ProductForm({ product, onClose, onSaved }: ProductFormProps) {
  const [draft, setDraft] = useState<ProductDraft>(() =>
    product
      ? { sku: product.sku, description: product.description, barcode: product.barcode }
      : EMPTY,
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function validate(): FieldErrors {
    const next: FieldErrors = {}

    if (!draft.sku.trim()) next.sku = 'Informe o código SKU.'
    if (!draft.description.trim()) next.description = 'Informe a descrição.'

    // EAN-8, UPC-12, EAN-13 e GTIN-14 são os formatos que aparecem no cadastro.
    if (draft.barcode && ![8, 12, 13, 14].includes(draft.barcode.length)) {
      next.barcode = 'Um código de barras tem 8, 12, 13 ou 14 dígitos.'
    }

    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    setFormError(null)
    setSaving(true)

    const payload: ProductDraft = {
      sku: draft.sku.trim(),
      description: draft.description.trim(),
      barcode: draft.barcode.trim(),
    }

    const { error } = product
      ? await updateProduct(product.id, payload)
      : await createProduct(payload)

    setSaving(false)

    if (error) {
      setFormError(SAVE_MESSAGES[error])
      return
    }

    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!product) return
    setSaving(true)
    await deleteProducts([product.id])
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={product ? 'Editar produto' : 'Novo produto'}
      subtitle={product ? `SKU ${product.sku}` : 'Cadastre um produto que não veio na planilha.'}
      footer={
        <>
          {product && !confirmingDelete && (
            <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Excluir
            </Button>
          )}
          {confirmingDelete && (
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancelar exclusão
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {confirmingDelete ? (
            <Button onClick={handleDelete} loading={saving}>
              Confirmar exclusão
            </Button>
          ) : (
            <Button type="submit" form="product-form" loading={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          )}
        </>
      }
    >
      {confirmingDelete && (
        <div className={styles.notice}>
          <Alert tone="danger">
            Excluir <strong>{product?.description}</strong> remove o produto do cadastro. Esta
            ação não pode ser desfeita.
          </Alert>
        </div>
      )}

      <form className={styles.form} id="product-form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Código SKU"
          value={draft.sku}
          onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
          error={errors.sku}
          hint="O código do produto no ERP."
          inputMode="numeric"
          autoComplete="off"
          disabled={confirmingDelete}
          required
        />

        <TextField
          label="Descrição do produto"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          error={errors.description}
          autoComplete="off"
          disabled={confirmingDelete}
          required
        />

        <TextField
          label="Código de barras"
          value={draft.barcode}
          // Só dígitos: teclado de celular e leitor óptico introduzem espaços
          // e hífens que quebrariam a comparação na importação.
          onChange={(e) => setDraft((d) => ({ ...d, barcode: digitsOnly(e.target.value) }))}
          error={errors.barcode}
          hint="EAN/GTIN. Deixe vazio se o produto não tiver."
          inputMode="numeric"
          autoComplete="off"
          optional
          disabled={confirmingDelete}
        />

        {formError && <Alert tone="danger">{formError}</Alert>}
      </form>
    </Dialog>
  )
}
