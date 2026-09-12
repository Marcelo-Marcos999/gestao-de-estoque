import { useEffect, useState } from 'react'
import { listProducts, type Product } from '@/features/products'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { AlertIcon, CheckIcon, SearchIcon } from '@/shared/ui/icons'
import { ScanButton } from '@/shared/ui/ScanButton'
import { TextField } from '@/shared/ui/TextField'
import { digitsOnly } from '@/shared/lib/cell'
import styles from './ProductPicker.module.css'

/** O que o formulário precisa saber sobre o produto escolhido. */
export interface ChosenProduct {
  productId: string
  sku: string
  description: string
  barcode: string
  pendingProduct: boolean
  /** Saldo atual, para o campo de quantidade saber o teto. */
  stock: number
}

interface ProductPickerProps {
  chosen: ChosenProduct | null
  onChoose: (product: ChosenProduct | null) => void
  onDescriptionChange: (description: string) => void
}

/**
 * Onde o operador encontra o produto — dentro do registro, no momento em que
 * precisa dele.
 *
 * É por isso que a tela do cadastro não fica no menu dele: ali o produto seria
 * um beco sem saída, e aqui ele é o primeiro passo do trabalho.
 *
 * Produto fora da base **não bloqueia**. A perda aconteceu de qualquer jeito, e
 * mandar procurar o administrador antes de registrar garante que o registro
 * não vai existir.
 */
export function ProductPicker({ chosen, onChoose, onDescriptionChange }: ProductPickerProps) {
  const [term, setTerm] = useState('')
  const debounced = useDebouncedValue(term, 250)
  const busca = debounced.trim()

  // O resultado guarda junto a busca que o produziu, e o que a tela mostra é
  // derivado dessa comparação. Assim o efeito só grava estado dentro da
  // resposta assíncrona — gravar "limpou" no corpo dele custaria um render a
  // mais e faria a lista piscar entre buscas.
  const [result, setResult] = useState<{ key: string; items: Product[] } | null>(null)
  const results = result?.key === busca ? result.items : null

  useEffect(() => {
    if (!busca) return

    let cancelled = false
    listProducts({ search: busca, onlyWithoutBarcode: false, onlyPending: false })
      .then((page) => {
        if (!cancelled) setResult({ key: busca, items: page.items.slice(0, 20) })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: busca, items: [] })
      })

    return () => {
      cancelled = true
    }
  }, [busca])

  if (chosen) {
    return (
      <div className={styles.picker}>
        <div className={`${styles.chosen} ${chosen.pendingProduct ? styles.pending : ''}`}>
          {chosen.pendingProduct ? (
            <AlertIcon className={`${styles.chosenIcon} ${styles.pendingIcon}`} width={20} height={20} />
          ) : (
            <CheckIcon className={`${styles.chosenIcon} ${styles.okIcon}`} width={20} height={20} />
          )}

          <div className={styles.chosenBody}>
            {chosen.pendingProduct ? (
              <>
                <span className={styles.pendingTitle}>
                  Este produto ainda não está no cadastro
                </span>
                <span className={styles.pendingText}>
                  Pode registrar mesmo assim. O administrador completa o cadastro depois.
                </span>
                <span className={styles.chosenCodes}>{chosen.barcode || chosen.sku}</span>
              </>
            ) : (
              <>
                <span className={styles.chosenName}>{chosen.description}</span>
                <span className={styles.chosenCodes}>
                  SKU {chosen.sku}
                  {chosen.barcode && ` · ${chosen.barcode}`}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            className={styles.change}
            onClick={() => {
              onChoose(null)
              setTerm('')
            }}
          >
            Trocar
          </button>
        </div>

        {/* O que fica pendente depende do que ele tinha em mãos: leu o código
            de barras, faltam SKU e descrição (ver docs/dominio.md). */}
        {chosen.pendingProduct && (
          <TextField
            label="Descrição do produto"
            hint="Como está na etiqueta. Ajuda o administrador a completar o cadastro."
            value={chosen.description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            autoComplete="off"
            optional
          />
        )}
      </div>
    )
  }

  /**
   * O código lido escolhe o produto sozinho quando não há dúvida.
   *
   * Quem apontou a câmera para a etiqueta já disse qual produto é; obrigar um
   * toque a mais para confirmar o único resultado seria pedir a mesma resposta
   * duas vezes. Com mais de um casamento — ou nenhum — a lista aparece e a
   * escolha continua sendo de quem está lendo.
   */
  async function scanned(code: string) {
    setTerm(code)

    const page = await listProducts({ search: code, onlyWithoutBarcode: false, onlyPending: false })
    if (page.items.length !== 1) return

    const product = page.items[0]
    onChoose({
      productId: product.id,
      sku: product.sku,
      description: product.description,
      barcode: product.barcode,
      pendingProduct: false,
      stock: product.stock,
    })
  }

  const soDigitos = digitsOnly(busca)
  const pareceCodigo = soDigitos.length >= 8 && soDigitos === busca

  return (
    <div className={styles.picker}>
      <div className={styles.searchRow}>
        <div className={styles.search}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            className={styles.input}
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Código de barras, SKU ou descrição"
            aria-label="Buscar produto"
            autoComplete="off"
            autoFocus
          />
        </div>

        {/* A câmera é o caminho principal no corredor; a digitação é a saída
            para quando o código está apagado, e o único caminho onde o
            aparelho não sabe ler. */}
        <ScanButton onDetect={(code) => void scanned(code)} label="Ler o código do produto" />
      </div>

      {results !== null && results.length > 0 && (
        <div className={styles.results}>
          {results.map((product) => (
            <button
              type="button"
              className={styles.result}
              key={product.id}
              onClick={() =>
                onChoose({
                  productId: product.id,
                  sku: product.sku,
                  description: product.description,
                  barcode: product.barcode,
                  pendingProduct: false,
                  stock: product.stock,
                })
              }
            >
              <span className={styles.resultName}>{product.description}</span>
              <span className={styles.resultCodes}>
                SKU {product.sku}
                {product.barcode && ` · ${product.barcode}`}
              </span>
            </button>
          ))}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className={styles.results}>
          <p className={styles.empty}>
            Nenhum produto encontrado para “{busca}”.
          </p>
          <button
            type="button"
            className={styles.result}
            onClick={() =>
              onChoose({
                productId: '',
                // Sem cadastro, o que ele tinha em mãos vira a identificação.
                sku: pareceCodigo ? '' : busca,
                description: '',
                barcode: pareceCodigo ? soDigitos : '',
                pendingProduct: true,
                stock: 0,
              })
            }
          >
            <span className={styles.resultName}>Registrar mesmo assim</span>
            <span className={styles.resultCodes}>
              entra como pendente de cadastro
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
