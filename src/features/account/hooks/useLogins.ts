import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/shared/lib/http'
import {
  createLogin,
  getCompany,
  listLogins,
  resetLoginPassword,
  setLoginActive,
} from '../api'
import type { Company, LoginWithPassword, NewLoginDraft, StoreLogin } from '../types'

export type LoginsStatus = 'loading' | 'error' | 'ready'

/** Mensagem pronta para a tela: a do servidor quando é para a pessoa ler, uma nossa nos demais casos. */
function messageOf(erro: unknown): string {
  return erro instanceof ApiError ? erro.message : 'Não foi possível concluir. Verifique a conexão e tente de novo.'
}

/**
 * Logins da conta e o plano que limita quantos podem existir.
 *
 * Os dois chegam juntos porque a tela mostra "3 de 5 logins" e decide se o
 * botão de criar está liberado — um sem o outro deixaria a pessoa descobrir o
 * limite só no erro.
 */
export function useLogins() {
  const [logins, setLogins] = useState<StoreLogin[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [status, setStatus] = useState<LoginsStatus>('loading')

  const load = useCallback(async () => {
    try {
      const [loaded, plan] = await Promise.all([listLogins(), getCompany()])
      setLogins(loaded)
      setCompany(plan)
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

  /** Cada ação devolve o erro (ou o resultado) em vez de lançar: quem chama é um diálogo que mostra a mensagem. */
  const create = useCallback(
    async (draft: NewLoginDraft): Promise<{ data: LoginWithPassword | null; error: string | null }> => {
      try {
        const data = await createLogin(draft)
        await load()
        return { data, error: null }
      } catch (erro) {
        return { data: null, error: messageOf(erro) }
      }
    },
    [load],
  )

  const toggleActive = useCallback(
    async (login: StoreLogin): Promise<string | null> => {
      try {
        await setLoginActive(login.id, !login.active)
        await load()
        return null
      } catch (erro) {
        return messageOf(erro)
      }
    },
    [load],
  )

  const resetPassword = useCallback(
    async (login: StoreLogin): Promise<{ password: string | null; error: string | null }> => {
      try {
        return { password: await resetLoginPassword(login.id), error: null }
      } catch (erro) {
        return { password: null, error: messageOf(erro) }
      }
    },
    [],
  )

  return { logins, company, status, reload, create, toggleActive, resetPassword }
}
