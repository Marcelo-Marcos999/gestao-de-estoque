import { useCallback, useEffect, useState } from 'react'
import { countTagUsage } from '../api'
import { readOrigins, readReasons, writeOrigins, writeReasons } from '../tags'
import type { Tag } from '../types'

export type TagKind = 'reason' | 'origin'

/** Quantos registros usam cada etiqueta, por id. */
export type TagUsage = Record<string, number>

/**
 * As listas de motivo e origem, prontas para o formulário.
 *
 * Ficam em estado porque mudam quando alguém cria ou corrige uma etiqueta
 * durante o preenchimento; reler o storage a cada render não deixaria a tela
 * mais em dia e custaria uma leitura por tecla digitada.
 *
 * A lista é uma só, da loja: se cada pessoa mantivesse a própria, "danificado",
 * "danificada" e "avaria" virariam três motivos e a soma por motivo deixaria de
 * fechar (ver docs/dominio.md).
 */
export function useTagLists() {
  const [reasons, setReasons] = useState<Tag[]>(() => readReasons())
  const [origins, setOrigins] = useState<Tag[]>(() => readOrigins())
  const [usage, setUsage] = useState<{ reasons: TagUsage; origins: TagUsage }>({
    reasons: {},
    origins: {},
  })

  // A contagem é lida uma vez e depois de cada exclusão: ela só existe para a
  // tela saber o que ainda não pode sair, e o registro que muda enquanto a
  // lista está aberta é o que a própria pessoa acabou de mexer.
  const refreshUsage = useCallback(() => {
    let cancelled = false
    countTagUsage().then((counts) => {
      if (!cancelled) setUsage(counts)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => refreshUsage(), [refreshUsage])

  /** Grava a lista inteira, que é como o storage a guarda. */
  const commit = useCallback((kind: TagKind, next: Tag[]) => {
    if (kind === 'reason') {
      setReasons(next)
      writeReasons(next)
    } else {
      setOrigins(next)
      writeOrigins(next)
    }
  }, [])

  const addReason = useCallback(
    (tag: Tag) => setReasons((current) => {
      const next = [...current, tag]
      writeReasons(next)
      return next
    }),
    [],
  )

  const addOrigin = useCallback(
    (tag: Tag) => setOrigins((current) => {
      const next = [...current, tag]
      writeOrigins(next)
      return next
    }),
    [],
  )

  /**
   * Renomear é sempre seguro: o registro aponta para o `id`, não para o texto,
   * então corrigir "danificada" para "Danificado" conserta os registros que já
   * existem em vez de criar um motivo paralelo.
   */
  const renameTag = useCallback(
    (kind: TagKind, id: string, label: string) => {
      const texto = label.trim()
      if (!texto) return

      const lista = kind === 'reason' ? reasons : origins
      commit(
        kind,
        lista.map((tag) => (tag.id === id ? { ...tag, label: texto } : tag)),
      )
    },
    [reasons, origins, commit],
  )

  /**
   * Excluir só vale para etiqueta que ninguém usa. Uma etiqueta em uso sairia
   * deixando os registros dela apontando para o nada — e a lista de quebra
   * mostraria motivo em branco sem explicação. Quem chama confere `usage`
   * antes; aqui a checagem se repete porque a regra é da lista, não da tela.
   */
  const deleteTag = useCallback(
    (kind: TagKind, id: string) => {
      const emUso = (kind === 'reason' ? usage.reasons : usage.origins)[id] ?? 0
      if (emUso > 0) return

      const lista = kind === 'reason' ? reasons : origins
      commit(
        kind,
        lista.filter((tag) => tag.id !== id),
      )
    },
    [reasons, origins, usage, commit],
  )

  return {
    reasons,
    origins,
    usage,
    addReason,
    addOrigin,
    renameTag,
    deleteTag,
    refreshUsage,
  }
}
