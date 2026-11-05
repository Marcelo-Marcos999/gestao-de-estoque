/**
 * Telefone brasileiro: o banco guarda só os dígitos (DDD + número, 10 ou 11), e a tela
 * mostra com máscara. Um formato só no banco é o que deixa a busca e o link do
 * WhatsApp simples, sem adivinhar parênteses e traços.
 */

/** Só os dígitos, no máximo 11 (DDD + celular com o 9). */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

/** "(11) 98765-4321" ou "(11) 3456-7890"; parcial enquanto a pessoa digita. */
export function formatPhone(value: string): string {
  const d = phoneDigits(value)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = `(${d.slice(0, 2)}) `
  if (d.length <= 6) return ddd + d.slice(2)
  // Fixo tem 8 dígitos depois do DDD; celular, 9. O traço vai antes dos 4 últimos.
  const cut = d.length === 11 ? 7 : 6
  return `${ddd}${d.slice(2, cut)}-${d.slice(cut)}`
}

/** Vazio vale ("não informado"); preenchido, precisa de DDD e do número inteiro. */
export function isValidPhone(value: string): boolean {
  const n = phoneDigits(value).length
  return n === 0 || n === 10 || n === 11
}

/** Link para ligar. Só dígitos, com o código do país. */
export const phoneHref = (digits: string) => `tel:+55${digits}`

/** Link para abrir a conversa no WhatsApp (o número vai com o código do Brasil). */
export const whatsappHref = (digits: string) => `https://wa.me/55${digits}`
