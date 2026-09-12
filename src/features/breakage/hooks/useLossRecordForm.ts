import { useCallback, useEffect, useMemo, useState } from 'react'
import { getProduct } from '@/features/products'
import type { IsoDate } from '@/shared/lib/date'
import { addToRecord, createLossRecord, findSameRecord, updateLossRecord } from '../api'
import { putAttachmentFile } from '../attachments'
import type { AttachmentKind, LossRecord, LossRecordDraft } from '../types'
import type { ChosenProduct } from '../components/ProductPicker'
import { useTagLists } from './useTagLists'

export interface FormErrors {
  product?: string
  reason?: string
}

/**
 * O registro que abriu o formulário em modo de edição, traduzido para o estado
 * inicial dos campos. Ausente quando é um registro novo.
 */
function initialProduct(record: LossRecord | undefined): ChosenProduct | null {
  if (!record) return null

  return {
    productId: record.productId,
    sku: record.sku,
    description: record.description,
    barcode: record.barcode,
    pendingProduct: record.pendingProduct,
    // Provisório: o saldo real chega do cadastro logo em seguida. Começar pela
    // quantidade já gravada evita que o campo acuse "acima do estoque" no
    // primeiro quadro, por um saldo que ainda não foi lido.
    stock: record.quantity,
  }
}

/**
 * Estado do formulário de registro de quebra, separado do desenho.
 *
 * Fica aqui tudo que decide *o que* acontece: montar o rascunho, checar se já
 * existe registro igual, e gravar — registro novo, alteração de um existente,
 * ou soma ao que já existe.
 *
 * O `editing` chega uma vez e vira estado inicial; o diálogo é remontado por
 * chave a cada abertura, então não há efeito sincronizando prop com estado.
 */
export function useLossRecordForm(
  createdBy: string,
  onSaved: () => void,
  editing?: LossRecord,
) {
  const [product, setProduct] = useState<ChosenProduct | null>(() => initialProduct(editing))
  const [expiryDate, setExpiryDate] = useState<IsoDate | null>(editing?.expiryDate ?? null)
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1)
  const [reasonId, setReasonId] = useState(editing?.reasonId ?? '')
  const [originId, setOriginId] = useState(editing?.originId ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [attachments, setAttachments] = useState<LossRecordDraft['attachments']>(
    editing?.attachments ?? [],
  )

  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const { reasons, origins, usage, addReason, addOrigin, renameTag, deleteTag } = useTagLists()

  /** Registro igual encontrado; quando presente, o aviso está aberto. */
  const [duplicate, setDuplicate] = useState<LossRecord | null>(null)

  // Na edição o registro guarda o produto, não o saldo dele. Sem buscar o saldo
  // atual, o campo de quantidade mostraria como teto a própria quantidade
  // gravada — e diria "de 2 em estoque" para um produto com 40.
  const editingProductId = editing?.productId
  useEffect(() => {
    if (!editingProductId) return

    let cancelled = false
    getProduct(editingProductId).then((found) => {
      if (cancelled || !found) return
      setProduct((current) =>
        current && current.productId === found.id ? { ...current, stock: found.stock } : current,
      )
    })

    return () => {
      cancelled = true
    }
  }, [editingProductId])

  const draft = useMemo<LossRecordDraft>(
    () => ({
      productId: product?.productId ?? '',
      sku: product?.sku ?? '',
      description: product?.description ?? '',
      barcode: product?.barcode ?? '',
      pendingProduct: product?.pendingProduct ?? false,
      expiryDate,
      quantity,
      reasonId,
      originId,
      note,
      attachments,
    }),
    [product, expiryDate, quantity, reasonId, originId, note, attachments],
  )

  /**
   * Guarda o arquivo e descreve o anexo.
   *
   * Um espaço por tipo: escolher de novo troca o que estava lá, em vez de
   * empilhar duas fotos do produto que ninguém saberia distinguir depois.
   */
  const attachFile = useCallback((kind: AttachmentKind, file: File) => {
    const id = `${kind}-${Date.now()}`
    putAttachmentFile(id, file)

    setAttachments((current) => [
      ...current.filter((a) => a.kind !== kind),
      { id, kind, fileName: file.name, mimeType: file.type, size: file.size },
    ])
  }, [])

  const removeAttachment = useCallback((kind: AttachmentKind) => {
    setAttachments((current) => current.filter((a) => a.kind !== kind))
  }, [])

  const persist = useCallback(async () => {
    setSaving(true)
    if (editing) await updateLossRecord(editing.id, draft)
    else await createLossRecord(draft, createdBy)
    setSaving(false)
    setDuplicate(null)
    onSaved()
  }, [draft, createdBy, editing, onSaved])

  /**
   * Grava o registro, avisando antes se já existe um igual.
   *
   * A checagem acontece no envio, não enquanto a pessoa preenche: um aviso que
   * aparece no meio da digitação interrompe sem que haja decisão a tomar.
   */
  const submit = useCallback(async () => {
    // A validação vive aqui dentro em vez de numa função à parte: uma função
    // recriada a cada render entraria nas dependências e derrubaria a
    // memoização deste callback a cada tecla digitada.
    const found: FormErrors = {}
    if (!product) found.product = 'Escolha o produto.'
    if (!reasonId) found.reason = 'Escolha o motivo.'

    setErrors(found)
    if (Object.keys(found).length) return

    setSaving(true)
    const igual = await findSameRecord(draft, editing?.id)
    setSaving(false)

    if (igual) {
      setDuplicate(igual)
      return
    }

    await persist()
  }, [draft, product, reasonId, editing, persist])

  const mergeIntoExisting = useCallback(async () => {
    if (!duplicate) return

    setSaving(true)
    await addToRecord(duplicate.id, quantity)
    setSaving(false)
    setDuplicate(null)
    onSaved()
  }, [duplicate, quantity, onSaved])

  return {
    /** True quando o formulário altera um registro que já existe. */
    editing: editing !== undefined,
    product,
    setProduct,
    expiryDate,
    setExpiryDate,
    quantity,
    setQuantity,
    reasonId,
    setReasonId,
    originId,
    setOriginId,
    note,
    setNote,
    attachments,
    attachFile,
    removeAttachment,
    reasons,
    origins,
    tagUsage: usage,
    addReason,
    addOrigin,
    renameTag,
    deleteTag,
    errors,
    saving,
    duplicate,
    dismissDuplicate: () => setDuplicate(null),
    submit,
    createSeparate: persist,
    mergeIntoExisting,
    /** Descrição digitada para um produto ainda sem cadastro. */
    setPendingDescription: (description: string) =>
      setProduct((current) => (current ? { ...current, description } : current)),
  }
}
