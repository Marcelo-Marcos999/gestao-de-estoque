import { clearDraft, markDraftClosed } from '../draft'

/**
 * As duas saídas do formulário de quebra.
 *
 * Fechar pelo X, pelo Esc ou pelo gesto de voltar NÃO apaga o que foi preenchido: quem
 * saiu para abrir a câmera, ou tocou sem querer, volta ao registro. Só "Cancelar" descarta.
 */
export function useDraftClose(usesDraft: boolean, onClose: () => void) {
  return {
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
