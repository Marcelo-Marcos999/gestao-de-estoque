import { useEffect, useState } from 'react'
import { attachmentsEnabled } from '../attachments'

/**
 * O servidor tem onde guardar os arquivos? `null` enquanto não respondeu.
 *
 * Sem armazenamento a tela não oferece os anexos: aceitar uma foto que não seria
 * guardada deixaria quem a tirou no corredor achando que ela foi.
 */
export function useAttachmentsEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void attachmentsEnabled().then((value) => {
      if (!cancelled) setEnabled(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return enabled
}
