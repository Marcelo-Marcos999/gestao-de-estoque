import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasOpenDraft } from '../draft'

/**
 * Ao abrir o app com um registro de quebra em andamento, leva à tela de Quebra, onde ele reabre.
 *
 * O Android pode descartar o app enquanto a galeria ou a câmera estão abertas, e o app
 * instalado recomeça numa tela qualquer (a inicial, não a que estava): sem isto o
 * registro continuava guardado, mas ninguém o veria. Roda uma vez, na abertura; depois
 * disso a navegação é da pessoa.
 */
export function useResumeDraft() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname !== '/quebra' && hasOpenDraft()) navigate('/quebra', { replace: true })
    // Só na abertura do app: reagir a `pathname` arrancaria a pessoa de qualquer tela que ela escolhesse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
