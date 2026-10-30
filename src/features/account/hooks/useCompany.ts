import { useCallback, useEffect, useState } from 'react'
import { getCompany } from '../api'
import type { Company } from '../types'

export type CompanyStatus = 'loading' | 'error' | 'ready'

/** A empresa e o plano dela, lidos do servidor. */
export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null)
  const [status, setStatus] = useState<CompanyStatus>('loading')

  const load = useCallback(async () => {
    try {
      setCompany(await getCompany())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    // `load` só chama setState depois de uma resposta, nunca de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const reload = useCallback(() => {
    setStatus('loading')
    return load()
  }, [load])

  /** Relê sem voltar ao "carregando": para depois de salvar, quando a tela já está pronta. */
  return { company, status, reload, refresh: load }
}
