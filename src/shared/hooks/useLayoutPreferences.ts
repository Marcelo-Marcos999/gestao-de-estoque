import { useCallback, useEffect } from 'react'
import { usePersistedState } from './usePersistedState'
import { useMediaQuery } from './useMediaQuery'
import { storageKey } from '../lib/storage'

const SIDEBAR_KEY = storageKey('layout', 'barra-lateral')
const FOCUS_KEY = storageKey('layout', 'modo-foco')

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Barra lateral recolhida.
 *
 * Preferência de quem usa, não estado de tela: quem trabalha o dia todo na
 * lista deixa recolhida e não quer reabrir a cada visita.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = usePersistedState<boolean>(SIDEBAR_KEY, false, isBoolean)
  const toggle = useCallback(() => setCollapsed((atual) => !atual), [setCollapsed])
  return { collapsed, toggle }
}

/**
 * Modo foco: o cabeçalho da página sai e a lista fica com a altura toda.
 *
 * É um só para o app inteiro, e não um por tela. Quem liga na tela de
 * validades espera encontrá-lo ligado na quebra — modo que se perde ao trocar
 * de tela vira um botão que ninguém usa.
 *
 * Esc desliga, porque é o que se espera de qualquer modo que esconde coisas:
 * sem essa saída, quem ligou sem querer precisa procurar o botão que sumiu do
 * lugar de onde ele olhava.
 *
 * **Não existe no celular.** Ali a página inteira rola, então o cabeçalho já
 * sai da tela sozinho ao rolar — e esconder à força o que a rolagem já resolve
 * só tiraria o título e as ações de quem tem menos tela para se localizar.
 * A preferência continua guardada: quem ligou no computador a encontra ligada
 * ao voltar para ele.
 */
export function useFocusMode() {
  const [preferido, setFocused] = usePersistedState<boolean>(FOCUS_KEY, false, isBoolean)
  const available = useMediaQuery('(min-width: 720px)')
  const focused = preferido && available

  useEffect(() => {
    if (!focused) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Um diálogo aberto trata o próprio Esc; não roubamos a tecla dele.
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return
      setFocused(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [focused, setFocused])

  const toggle = useCallback(() => setFocused((atual) => !atual), [setFocused])
  return { focused, available, toggle }
}
