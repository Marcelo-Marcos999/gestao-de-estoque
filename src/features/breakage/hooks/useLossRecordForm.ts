import { useCallback, useEffect, useMemo, useState } from 'react'
import { getProduct } from '@/features/products'
import type { IsoDate } from '@/shared/lib/date'
import { addToRecord, findSameRecord } from '../api'
import { putAttachmentFile } from '../attachments'
import { AttachmentsFailedError, saveLossRecord } from '../saveRecord'
import type {
  AttachmentKind,
  LossRecord,
  LossRecordDraft,
  LossRecordInitialDraft,
} from '../types'
import type { ChosenProduct } from '@/features/products'
import { useTagLists } from './useTagLists'

export interface FormErrors {
  product?: string
  reason?: string
  origin?: string
  /** Falha ao falar com o servidor, que não é de nenhum campo. */
  form?: string
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
 *
 * `initial` é o mesmo tipo de ponto de partida, mas para um registro que
 * ainda não existe — quem já sabe o produto e a validade (como a tela de
 * Validades, gerando a quebra de um lote vencido) chega com o formulário
 * pronto para revisão, em vez de repetir a busca. Só vale quando `editing`
 * está ausente: corrigir um registro que já existe usa os valores dele.
 */
export function useLossRecordForm(
  onSaved: () => void,
  editing?: LossRecord,
  initial?: LossRecordInitialDraft,
  /** A lista atrás do formulário precisa reler (sem fechá-lo): o registro mudou, mas um anexo falhou. */
  onChanged?: () => void,
) {
  const [product, setProduct] = useState<ChosenProduct | null>(
    () => initialProduct(editing) ?? initial?.product ?? null,
  )
  const [expiryDate, setExpiryDate] = useState<IsoDate | null>(
    editing?.expiryDate ?? initial?.expiryDate ?? null,
  )
  const [quantity, setQuantity] = useState(editing?.quantity ?? initial?.quantity ?? 1)

  const { reasons, origins, usage, addReason, addOrigin, renameTag, deleteTag } = useTagLists()

  // O motivo sugerido casa pelo nome, não por um id fixo: a lista é editável,
  // e "Vencido" pode ter sido renomeado ou excluído (ver docs/dominio.md).
  // Sem casamento, o campo fica vazio — nunca com um id que não existe mais.
  // A lista chega do servidor depois de o formulário abrir; por isso a
  // sugestão é calculada a cada render, e a escolha da pessoa, quando houver,
  // vale mais que ela (`null` = ainda não escolheu).
  const [chosenReasonId, setReasonId] = useState<string | null>(editing?.reasonId ?? null)
  const suggestedLabel = editing ? undefined : initial?.reasonLabel?.toLowerCase()
  const suggestedReasonId = suggestedLabel
    ? (reasons.find((r) => r.label.toLowerCase() === suggestedLabel)?.id ?? '')
    : ''
  const reasonId = chosenReasonId ?? suggestedReasonId

  const [originId, setOriginId] = useState(editing?.originId ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [attachments, setAttachments] = useState<LossRecordDraft['attachments']>(
    editing?.attachments ?? [],
  )
  // O que o servidor já tem deste registro: base para saber o que enviar e o que apagar.
  const [savedAttachments, setSavedAttachments] = useState(editing?.attachments ?? [])

  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

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
      // Corrigir o registro de outra loja (ou gerar a quebra de um lote dela) mantém a loja.
      storeId: editing?.storeId ?? initial?.storeId,
    }),
    [product, expiryDate, quantity, reasonId, originId, note, attachments, editing, initial],
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

  // Falha de rede ou recusa do servidor: sem isto o botão ficaria girando para
  // sempre, e quem tocou em "Salvar" não saberia se o registro existe.
  const reportFailure = useCallback((erro: unknown) => {
    setSaving(false)
    setDuplicate(null)
    setErrors({ form: erro instanceof Error ? erro.message : 'Não foi possível salvar.' })
  }, [])

  const persist = useCallback(async () => {
    setSaving(true)
    try {
      await saveLossRecord(draft, editing, savedAttachments)
    } catch (erro) {
      if (erro instanceof AttachmentsFailedError) {
        // Mantém o formulário com o que o servidor já tem, para tentar de novo.
        setSavedAttachments(erro.after.filter((a) => !erro.failed.includes(a)))
        setAttachments(erro.after)
        onChanged?.()
      }
      reportFailure(erro)
      return
    }
    setSaving(false)
    setDuplicate(null)
    onSaved()
  }, [draft, editing, savedAttachments, onSaved, onChanged, reportFailure])

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
    if (!originId) found.origin = 'Escolha a origem.'

    setErrors(found)
    if (Object.keys(found).length) return

    setSaving(true)
    let igual: LossRecord | null
    try {
      igual = await findSameRecord(draft, editing?.id)
    } catch (erro) {
      reportFailure(erro)
      return
    }
    setSaving(false)

    if (igual) {
      setDuplicate(igual)
      return
    }

    await persist()
  }, [draft, product, reasonId, originId, editing, persist, reportFailure])

  const mergeIntoExisting = useCallback(async () => {
    if (!duplicate) return

    setSaving(true)
    try {
      await addToRecord(duplicate.id, quantity)
    } catch (erro) {
      reportFailure(erro)
      return
    }
    setSaving(false)
    setDuplicate(null)
    onSaved()
  }, [duplicate, quantity, onSaved, reportFailure])

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
