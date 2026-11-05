import { clearDraft, markDraftClosed } from '../draft'
import { usePickerGuard } from './usePickerGuard'

/**
 * As duas saídas do formulário de quebra.
 *
 * Fechar pelo X, pelo Esc ou pelo gesto de voltar NÃO apaga o que foi preenchido: quem
 * saiu para abrir a câmera, ou tocou sem querer, volta ao registro. Só "Cancelar" descarta.
 * E enquanto o seletor de arquivos está aberto (e logo depois de voltar dele), fechar
 * pelo fundo ou pelo Esc é ignorado (ver `usePickerGuard`).
 */
export function useDraftClose(usesDraft: boolean, onClose: () => void) {
  const { picking, startPicking } = usePickerGuard()

  return {
    picking,
    startPicking,
    closeKeepingDraft: () => {
      if (usesDraft) markDraftClosed()
      onClose()
    },
    cancel: () => {
      if (usesDraft) clearDraft()
      onClose()
    },
  }
}
