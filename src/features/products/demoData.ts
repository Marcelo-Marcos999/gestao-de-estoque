/**
 * Base de demonstração.
 *
 * PROVISÓRIO: existe só enquanto não há back-end. Gera um volume parecido com
 * o real (~26 mil produtos) para a interface ser construída contra o problema
 * verdadeiro, não contra uma lista de dez itens. Sai junto com o mock do
 * `api.ts` quando o servidor existir.
 */
import type { Product } from './types'

/*
 * Catálogo fictício.
 *
 * Nomes genéricos de propósito: descrevem o tipo de produto sem citar
 * fabricante, linha comercial ou loja. Marca de terceiro em dado de exemplo dá
 * a impressão de que o sistema é de outra empresa.
 *
 * Cada item traz as próprias unidades e variações porque sortear tudo junto
 * produz descrição sem sentido — "rolo de lã 5KG", "pincel 1KG cinza". Dado de
 * demonstração implausível atrapalha na hora de avaliar a tela: quem olha para
 * de julgar o layout e passa a estranhar o conteúdo.
 */
const CATALOGO = [
  { nome: 'TINTA ACRÍLICA FOSCA', unidades: ['0,9L', '3,6L', '18L'], variacoes: ['BRANCO', 'GELO', 'PALHA', 'CINZA'] },
  { nome: 'TINTA ACRÍLICA ACETINADA', unidades: ['0,9L', '3,6L', '18L'], variacoes: ['BRANCO', 'AZUL', 'VERDE'] },
  { nome: 'TINTA ESMALTE SINTÉTICO', unidades: ['225ML', '900ML', '3,6L'], variacoes: ['BRANCO', 'PRETO', 'VERMELHO'] },
  { nome: 'TINTA LÁTEX PVA', unidades: ['3,6L', '18L'], variacoes: ['BRANCO', 'GELO'] },
  { nome: 'BASE NIVELADORA PAREDE', unidades: ['3,6L', '18L'], variacoes: ['INTERNA', 'EXTERNA'] },
  { nome: 'FUNDO PREPARADOR', unidades: ['900ML', '3,6L', '18L'], variacoes: ['BASE ÁGUA', 'BASE SOLVENTE'] },
  { nome: 'VERNIZ MARÍTIMO', unidades: ['900ML', '3,6L'], variacoes: ['INCOLOR', 'IMBUIA', 'MOGNO'] },
  { nome: 'VERNIZ POLIURETANO', unidades: ['900ML', '3,6L'], variacoes: ['BRILHANTE', 'ACETINADO'] },
  { nome: 'CORANTE LÍQUIDO', unidades: ['50ML'], variacoes: ['AMARELO ÓXIDO', 'VERMELHO ÓXIDO', 'AZUL', 'PRETO'] },
  { nome: 'MASSA CORRIDA', unidades: ['1,4KG', '5,7KG', '25KG'], variacoes: ['INTERNA'] },
  { nome: 'MASSA ACRÍLICA', unidades: ['1,4KG', '5,7KG', '25KG'], variacoes: ['EXTERNA'] },
  { nome: 'THINNER PARA LIMPEZA', unidades: ['900ML', '5L'], variacoes: ['COMUM', 'PROFISSIONAL'] },
  { nome: 'SOLVENTE AGUARRÁS', unidades: ['900ML', '5L'], variacoes: ['MINERAL'] },
  { nome: 'REMOVEDOR DE TINTA', unidades: ['900ML'], variacoes: ['GEL', 'LÍQUIDO'] },
  { nome: 'ROLO DE LÃ SINTÉTICA', unidades: ['9CM', '15CM', '23CM'], variacoes: ['PELO BAIXO', 'PELO ALTO'] },
  { nome: 'PINCEL CERDA NATURAL', unidades: ['1"', '2"', '3"'], variacoes: ['CABO MADEIRA', 'CABO PLÁSTICO'] },
  { nome: 'BROXA RETANGULAR', unidades: ['10CM', '15CM'], variacoes: ['CERDA MISTA'] },
  { nome: 'FITA CREPE PARA PINTURA', unidades: ['18MM X 50M', '24MM X 50M', '48MM X 50M'], variacoes: ['USO GERAL'] },
  { nome: "LIXA D'ÁGUA", unidades: ['GRÃO 220', 'GRÃO 320', 'GRÃO 400'], variacoes: ['FOLHA'] },
  { nome: 'ESPÁTULA DE AÇO', unidades: ['4CM', '8CM', '12CM'], variacoes: ['CABO MADEIRA'] },
]

/** Gerador determinístico: a mesma base em toda recarga facilita comparar telas. */
function pseudoRandom(seed: number) {
  let state = seed

  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

/** Dígito verificador de EAN-13, para os códigos parecerem reais. */
function ean13(base12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3)
  return base12 + ((10 - (sum % 10)) % 10)
}

export function generateProducts(count: number): Product[] {
  const random = pseudoRandom(20260828)
  const products: Product[] = []
  const timestamp = new Date('2026-01-15T09:00:00Z').toISOString()

  for (let i = 0; i < count; i++) {
    const item = CATALOGO[Math.floor(random() * CATALOGO.length)]
    const unidade = item.unidades[Math.floor(random() * item.unidades.length)]
    const variacao = item.variacoes[Math.floor(random() * item.variacoes.length)]
    const sku = String(10000 + i)

    // Cerca de 1 em 8 produtos sem código de barras, como no cadastro real.
    const temBarras = random() > 0.12
    const barcode = temBarras
      ? ean13(String(789000000000 + Math.floor(random() * 999999999)).slice(0, 12))
      : ''

    // Saldo pequeno e saídas esparsas, como numa loja real: a maior parte
    // gira devagar, e uma parte não teve saída nenhuma no período — é isso
    // que produz a faixa "sem estimativa".
    const stock = Math.floor(random() * 12)
    const outflow = random() > 0.28 ? Math.floor(random() * 60) : 0

    // Custo abaixo de venda numa faixa plausível de tinta e ferragem — a
    // demonstração existe para julgar a tela, não para acertar o preço real.
    const costPrice = Math.round((8 + random() * 180) * 100) / 100
    const salePrice = Math.round(costPrice * (1.3 + random() * 0.6) * 100) / 100

    products.push({
      id: `p${sku}`,
      sku,
      description: `${item.nome} ${unidade} ${variacao}`,
      barcode,
      stock,
      outflow,
      costPrice,
      salePrice,
      pendingCadastro: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  return products
}
