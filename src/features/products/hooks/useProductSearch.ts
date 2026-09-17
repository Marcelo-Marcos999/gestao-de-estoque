import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { listProducts } from '../api'
import { EMPTY_PRODUCT_RANGES, type Product } from '../types'

/** Quantos resultados a lista mostra: o suficiente para reconhecer, não para navegar. */
const LIMITE = 20

/**
 * Busca de produto por texto, com espera entre teclas.
 *
 * Sem a espera, cada tecla dispararia uma varredura de 26 mil registros.
 *
 * O resultado guarda junto a busca que o produziu, e quem desenha deriva o que
 * mostrar dessa comparação. Assim o efeito só grava estado dentro da resposta
 * assíncrona — gravar "limpou" no corpo dele custaria um render a mais e faria
 * a lista piscar entre buscas.
 *
 * `results` é `null` enquanto não há resposta para o termo atual, e um array
 * (possivelmente vazio) quando há: são estados diferentes, e confundi-los faria
 * "nenhum produto encontrado" aparecer no meio da digitação.
 */
export function useProductSearch(term: string) {
  const debounced = useDebouncedValue(term, 250)
  const busca = debounced.trim()

  const [result, setResult] = useState<{ key: string; items: Product[] } | null>(null)

  useEffect(() => {
    if (!busca) return

    let cancelled = false
    listProducts({
      search: busca,
      onlyWithoutBarcode: false,
      onlyPending: false,
      numberRanges: EMPTY_PRODUCT_RANGES,
    })
      .then((page) => {
        if (!cancelled) setResult({ key: busca, items: page.items.slice(0, LIMITE) })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: busca, items: [] })
      })

    return () => {
      cancelled = true
    }
  }, [busca])

  return {
    /** O termo já com a espera aplicada, sem espaços nas pontas. */
    busca,
    results: result?.key === busca ? result.items : null,
  }
}
