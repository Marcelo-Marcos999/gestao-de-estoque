/**
 * Reduz uma foto antes do envio.
 *
 * Uma foto de celular passa de 4 MB, e quem a envia está no 4G da loja: reduzida
 * a 1600 px no lado maior e recomprimida, fica em algumas centenas de KB e continua
 * legível para conferir uma etiqueta. Também poupa o bucket.
 *
 * Nunca falha: qualquer dificuldade (formato que o navegador não decodifica, como
 * HEIC em alguns aparelhos; falta de memória) devolve o arquivo original — enviar
 * grande é melhor que não enviar.
 */
export async function reduceImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  // PDF e GIF seguem como estão (o GIF perderia a animação, e ninguém anexa um).
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  try {
    // Respeita a orientação gravada pela câmera: sem isso, a foto "em pé" sairia deitada.
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))

    // Já pequena em pixels e em bytes: recomprimir só pioraria a imagem.
    if (scale === 1 && file.size <= 600 * 1024) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    // Se não ficou menor (ex.: PNG simples), o original é melhor.
    if (!blob || blob.size >= file.size) return file

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
