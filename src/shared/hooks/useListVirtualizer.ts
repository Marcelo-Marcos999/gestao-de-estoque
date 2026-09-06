import { useLayoutEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

/** Marca o elemento que rola a página; as listas o procuram por aqui. */
export const PAGE_SCROLLER_ATTR = 'data-page-scroller'

interface Options {
  count: number
  /**
   * Altura provável de uma linha, usada só até ela ser medida de verdade.
   * Um palpite próximo do real deixa a barra de rolagem estável desde o
   * primeiro quadro.
   */
  estimateSize: number
  /** Tela estreita: quem rola é a página, não a lista. */
  narrow: boolean
}

/**
 * Virtualização que muda de âncora conforme a largura da tela.
 *
 * No computador a lista rola dentro de si, com o cabeçalho das colunas parado
 * no topo — é o que se espera de uma tabela.
 *
 * No celular isso dá uma janelinha rolando dentro de uma tela que não rola: o
 * cabeçalho da página come metade da altura e a lista fica espremida no resto.
 * Ali quem rola é a **página inteira**, e a lista continua virtualizada usando
 * essa rolagem — sem isso, o cadastro renderizaria 26 mil linhas de uma vez.
 *
 * O preço de virtualizar por um elemento que não é o pai direto é o
 * `scrollMargin`: a distância entre o topo da lista e o topo do que rola. Sem
 * ele, o virtualizador acha que a lista começa onde o cabeçalho começa e
 * desenha as linhas erradas.
 */
export function useListVirtualizer({ count, estimateSize, narrow }: Options) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  const pageScroller = () =>
    scrollerRef.current?.closest<HTMLElement>(`[${PAGE_SCROLLER_ATTR}]`) ?? null

  // Sem lista de dependências de propósito: o que desloca a lista é a altura do
  // cabeçalho, que muda quando a faixa de filtro ou a barra de seleção aparece
  // — sempre junto de um render, e nunca por uma dependência que se possa
  // declarar. O laço que a regra teme não acontece porque o estado só é
  // gravado quando o valor medido muda de verdade.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!narrow) {
      setScrollMargin(0)
      return
    }

    const canvas = canvasRef.current
    const scroller = pageScroller()
    if (!canvas || !scroller) return

    const valor =
      canvas.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop

    setScrollMargin((atual) => (Math.abs(atual - valor) > 1 ? valor : atual))
  })

  // O TanStack Virtual devolve funções que a checagem de hooks não consegue
  // provar seguras para memoizar. É limitação da análise, não do uso: o
  // virtualizador é feito para ser chamado exatamente assim.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => (narrow ? pageScroller() : scrollerRef.current),
    estimateSize: () => estimateSize,
    overscan: 8,
    scrollMargin,
    // No celular a descrição do produto ocupa uma ou duas linhas conforme o
    // nome. Com altura fixa, o nome de duas linhas passava por cima do SKU.
    // Medindo cada linha depois de desenhada, ela cresce só o necessário.
    measureElement: (element) => element.getBoundingClientRect().height,
  })

  return { virtualizer, scrollerRef, canvasRef, scrollMargin }
}
