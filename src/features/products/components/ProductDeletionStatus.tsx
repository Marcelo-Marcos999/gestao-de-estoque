import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import type { ProductDeletion } from '../hooks/useProductDeletion'
import styles from './ProductDeletionStatus.module.css'

/**
 * O que a exclusão tem a dizer: está andando, falhou, terminou, ou precisa de
 * uma decisão (produtos com estoque). Fica fora da página só para ela não crescer.
 */
export function ProductDeletionStatus({ deletion }: { deletion: ProductDeletion }) {
  const { busy, error, notice, pending } = deletion
  const n = pending.length

  return (
    <>
      {busy > 0 && (
        <div className={styles.status} role="status">
          <Alert>
            Excluindo {busy.toLocaleString('pt-BR')} produto{busy === 1 ? '' : 's'}… não feche esta tela.
          </Alert>
        </div>
      )}

      {error && (
        <div className={styles.status}>
          <Alert tone="danger">{error}</Alert>
          <Button variant="ghost" onClick={deletion.dismissMessage}>
            Fechar aviso
          </Button>
        </div>
      )}

      {notice && (
        <div className={styles.status}>
          <Alert tone="success">{notice}</Alert>
          <Button variant="ghost" onClick={deletion.dismissMessage}>
            Fechar aviso
          </Button>
        </div>
      )}

      <Dialog
        open={n > 0}
        onClose={deletion.dismissPending}
        title="Excluir também o estoque?"
        subtitle={`${n.toLocaleString('pt-BR')} produto${n === 1 ? '' : 's'} não ${
          n === 1 ? 'foi excluído' : 'foram excluídos'
        }`}
        footer={
          <>
            <Button variant="secondary" onClick={deletion.dismissPending}>
              Manter
            </Button>
            <Button variant="danger" onClick={() => void deletion.confirmWithStock()}>
              Excluir com o estoque
            </Button>
          </>
        }
      >
        <div className={styles.body}>
          <p>
            {n === 1 ? 'Este produto tem' : 'Estes produtos têm'} estoque lançado e por isso{' '}
            {n === 1 ? 'ficou' : 'ficaram'} no cadastro.
          </p>
          <p>
            Se continuar, o <strong>estoque</strong> {n === 1 ? 'dele' : 'deles'} (em todas as lojas da
            conta) e os <strong>lotes de validade</strong> também são apagados. Os registros de quebra
            ficam, sem o vínculo com o produto. <strong>Não tem desfazer.</strong>
          </p>
        </div>
      </Dialog>
    </>
  )
}
