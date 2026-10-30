import { apiFetch } from '@/shared/lib/http'

/** O período gravado no login, ou `null` se a pessoa nunca definiu (vale o padrão). */
export async function getPeriodPreference(): Promise<number | null> {
  const { periodoSaidasDias } = await apiFetch<{ periodoSaidasDias: number | null }>(
    '/conta/preferencias',
  )
  return periodoSaidasDias
}

export async function savePeriodPreference(days: number): Promise<void> {
  await apiFetch('/conta/preferencias', {
    method: 'PATCH',
    body: { periodoSaidasDias: days },
  })
}
