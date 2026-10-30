import { useCallback, useEffect, useState } from 'react'
import {
  createTag,
  deleteTag as deleteRemoteTag,
  loadTags,
  isTagConflict,
  renameTag as renameRemoteTag,
  type TagKind,
  type TagLists,
  type TagUsage,
} from '../tags'
import type { Tag } from '../types'

export type { TagKind, TagUsage }

const EMPTY: TagLists = { reasons: [], origins: [], usage: { reasons: {}, origins: {} } }

/**
 * As listas de motivo e origem, prontas para o formulário.
 *
 * A lista é uma só, da conta: se cada pessoa mantivesse a própria,
 * "danificado", "danificada" e "avaria" virariam três motivos e a soma por
 * motivo deixaria de fechar (ver docs/dominio.md).
 *
 * Toda alteração vai ao servidor primeiro e só depois muda a tela, e uma falha
 * recarrega a lista: mostrar uma etiqueta que o servidor recusou faria o
 * registro apontar, ao salvar, para um id que não existe.
 */
export function useTagLists() {
  const [lists, setLists] = useState<TagLists>(EMPTY)

  const refresh = useCallback(async () => {
    try {
      setLists(await loadTags())
    } catch {
      // Sem conexão a lista fica como estava; o formulário avisa ao salvar.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadTags()
      .then((loaded) => {
        if (!cancelled) setLists(loaded)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  /** Cria a etiqueta no servidor e a devolve, já com o id definitivo. */
  const create = useCallback(async (kind: TagKind, label: string): Promise<Tag> => {
    const tag = await createTag(kind, label)
    setLists((current) =>
      kind === 'reason'
        ? { ...current, reasons: [...current.reasons, tag] }
        : { ...current, origins: [...current.origins, tag] },
    )
    return tag
  }, [])

  const addReason = useCallback((label: string) => create('reason', label), [create])
  const addOrigin = useCallback((label: string) => create('origin', label), [create])

  /**
   * Renomear é sempre seguro: o registro aponta para o `id`, não para o texto,
   * então corrigir "danificada" para "Danificado" conserta os registros que já
   * existem em vez de criar um motivo paralelo.
   */
  const renameTag = useCallback(
    async (kind: TagKind, id: string, label: string) => {
      const texto = label.trim()
      if (!texto) return

      try {
        await renameRemoteTag(kind, id, texto)
      } catch (erro) {
        // Nome que já existe: a lista recarregada volta ao nome de antes.
        if (!isTagConflict(erro)) throw erro
      } finally {
        await refresh()
      }
    },
    [refresh],
  )

  /**
   * Excluir só vale para etiqueta que ninguém usa: uma etiqueta em uso sairia
   * deixando os registros dela apontando para o nada. O servidor recusa (409),
   * inclusive pelo uso nas outras lojas da conta, que esta tela não enxerga.
   */
  const deleteTag = useCallback(
    async (kind: TagKind, id: string) => {
      try {
        await deleteRemoteTag(kind, id)
      } catch (erro) {
        // Em uso: a lista recarregada mantém a etiqueta, com a contagem certa.
        if (!isTagConflict(erro)) throw erro
      } finally {
        await refresh()
      }
    },
    [refresh],
  )

  return {
    reasons: lists.reasons,
    origins: lists.origins,
    usage: lists.usage,
    addReason,
    addOrigin,
    renameTag,
    deleteTag,
  }
}
