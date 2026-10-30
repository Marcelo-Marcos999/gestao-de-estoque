import { useEffect, useState } from 'react'
import { getServerFeatures } from '../api'

/**
 * Se o servidor consegue enviar e-mail. `null` enquanto não se sabe.
 *
 * Existe para as telas esconderem "Criar conta" e "Esqueci minha senha" quando
 * não há como entregar o link: oferecer o botão e só avisar do erro depois de
 * a pessoa preencher o formulário é a pior hora de descobrir.
 *
 * `null` conta como "disponível" para quem usa: o servidor gratuito pode levar
 * meio minuto para acordar, e sumir com os links enquanto isso pioraria o caso
 * normal por causa do caso raro. Só um "não" explícito esconde.
 */
export function useEmailAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    getServerFeatures()
      .then((features) => {
        if (!cancelled) setAvailable(features.emailActive)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return available
}
