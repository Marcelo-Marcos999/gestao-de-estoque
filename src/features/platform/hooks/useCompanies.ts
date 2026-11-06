import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/shared/lib/http'
import { listCompanies } from '../api'
import type { PlatformCompany } from '../types'

export type CompaniesStatus = 'loading' | 'error' | 'ready'

/**
 * As empresas do painel. `onExpired` roda quando o servidor recusa o token (uma hora
 * de validade, ou o administrador foi desativado): a página volta ao login.
 */
export function useCompanies(token: string, onExpired: () => void) {
  const [companies, setCompanies] = useState<PlatformCompany[]>([])
  const [status, setStatus] = useState<CompaniesStatus>('loading')

  const load = useCallback(async () => {
    try {
      setCompanies(await listCompanies(token))
      setStatus('ready')
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 401) onExpired()
      else setStatus('error')
    }
  }, [token, onExpired])

  useEffect(() => {
    // `load` só chama setState depois de uma resposta, nunca de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const reload = useCallback(() => {
    setStatus('loading')
    return load()
  }, [load])

  /** Relê sem voltar ao "carregando": para depois de alterar algo, quando a lista já está na tela. */
  return { companies, status, reload, refresh: load }
}
