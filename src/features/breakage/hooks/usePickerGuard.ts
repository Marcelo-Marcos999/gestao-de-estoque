import { useCallback, useState } from 'react'

/** Depois que a pessoa volta do seletor, por quanto tempo ainda se ignora o "fechar sem querer". */
const GRACE_MS = 1500

/** Se o seletor nunca devolver o foco (aparelho estranho), a proteção solta sozinha. */
const MAX_MS = 2 * 60_000

/**
 * Protege o formulário enquanto o seletor de arquivos (galeria, arquivos ou câmera) está aberto.
 *
 * No celular o seletor é outra tela por cima do app. Ao voltar dele, o navegador pode
 * entregar um toque (ou um "voltar") que cai no fundo escuro atrás do formulário, e o
 * fundo fecha o diálogo: o registro some sem ninguém ter pedido. Enquanto `picking`
 * for verdadeiro o formulário ignora o fechar pelo fundo e pelo Esc (o botão X e o
 * Cancelar continuam valendo). A proteção solta pouco depois de o app recuperar o foco.
 */
export function usePickerGuard() {
  const [picking, setPicking] = useState(false)

  const startPicking = useCallback(() => {
    setPicking(true)

    let released = false
    const release = () => {
      if (released) return
      released = true
      window.removeEventListener('focus', onBack)
      document.removeEventListener('visibilitychange', onVisible)
      window.setTimeout(() => setPicking(false), GRACE_MS)
    }
    const onBack = () => release()
    const onVisible = () => {
      if (document.visibilityState === 'visible') release()
    }

    window.addEventListener('focus', onBack)
    document.addEventListener('visibilitychange', onVisible)
    window.setTimeout(release, MAX_MS)
  }, [])

  return { picking, startPicking }
}
