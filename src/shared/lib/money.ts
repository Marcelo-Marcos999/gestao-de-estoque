/**
 * Dinheiro em reais, no formato que as telas mostram ("R$ 1.234,50").
 *
 * Fica em `shared/` porque Estoque, Validades e Quebra exibem o mesmo número —
 * o custo vem do estoque, e as três precisam escrevê-lo igual.
 */
export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Quantidade × valor unitário, arredondado em centavos.
 *
 * Nunca guardado — é conta sobre o que já existe, pela mesma razão do total
 * de Estoque (ver `features/stock/totals.ts`): guardar o resultado o deixaria
 * desatualizado assim que alguém corrigisse o saldo ou o custo. O
 * arredondamento evita que 3 × 1,10 vire 3,3000000000000003 e entre assim num
 * filtro por faixa ou numa planilha exportada.
 */
export function lineTotal(quantity: number, unitValue: number): number {
  return Math.round(quantity * unitValue * 100) / 100
}
