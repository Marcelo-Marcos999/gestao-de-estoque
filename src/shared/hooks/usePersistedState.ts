import { useCallback, useEffect, useRef, useState } from 'react'
import { readJson, writeJson } from '@/shared/lib/storage'

type Ouvinte = (value: unknown) => void

/**
 * Quem está usando cada chave, para que uma gravação alcance todos.
 *
 * Sem isto, dois lugares que leem a mesma preferência ficam com duas cópias
 * independentes: o segundo continua mostrando o valor antigo até a página ser
 * recarregada. Foi o que aconteceu com o modo foco — a tela escondia o
 * cabeçalho e a barra lateral, que lê a mesma chave, seguia aberta.
 */
const ouvintes = new Map<string, Set<Ouvinte>>()

/**
 * Estado de componente que sobrevive ao fechamento do app.
 *
 * Usado por filtros, buscas e seleções de aba: ver CLAUDE.md, "Filtros e
 * buscas são lembrados". Um `validate` opcional permite descartar um valor
 * gravado que não faz mais sentido — depois de uma mudança de formato, por
 * exemplo — em vez de deixar a tela num estado impossível.
 *
 * Instâncias que compartilham a chave compartilham o valor: gravar num lugar
 * atualiza todas as outras no mesmo instante.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T,
): [T, (value: T | ((current: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = readJson<unknown>(key, initialValue)
    if (validate) return validate(stored) ? stored : initialValue
    return stored as T
  })

  // O valor mais recente fora do ciclo do render: `update` precisa dele para
  // resolver a forma de função sem entrar no updater do setState, onde um
  // efeito colateral rodaria durante o render.
  const atual = useRef(state)

  // A identidade do ouvinte é o que permite não avisar a si mesmo; por isso ele
  // é criado uma vez e guardado, em vez de nascer a cada render.
  const ouvinte = useRef<Ouvinte>((value) => {
    atual.current = value as T
    setState(value as T)
  })

  useEffect(() => {
    const meu = ouvinte.current
    const daChave = ouvintes.get(key) ?? new Set<Ouvinte>()
    daChave.add(meu)
    ouvintes.set(key, daChave)

    return () => {
      daChave.delete(meu)
      // A chave sem ninguém sai do mapa: uma tela que não existe mais não
      // precisa deixar rastro à espera de um aviso que nunca vai usar.
      if (daChave.size === 0) ouvintes.delete(key)
    }
  }, [key])

  const update = useCallback(
    (value: T | ((current: T) => T)) => {
      const next = typeof value === 'function' ? (value as (c: T) => T)(atual.current) : value

      atual.current = next
      writeJson(key, next)
      setState(next)

      for (const outro of ouvintes.get(key) ?? []) {
        if (outro !== ouvinte.current) outro(next)
      }
    },
    [key],
  )

  return [state, update]
}
