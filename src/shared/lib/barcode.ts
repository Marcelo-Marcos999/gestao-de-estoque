/**
 * Leitura de código de barras pela câmera.
 *
 * Usa o `BarcodeDetector` do próprio navegador em vez de uma biblioteca de
 * decodificação. A decisão tem um custo: o Safari não implementa a API, então
 * no iPhone o botão não aparece. Em troca, o app não carrega centenas de
 * kilobytes de WebAssembly que a maioria dos usuários nunca usaria, e a leitura
 * roda no código nativo do aparelho, que é mais rápido que qualquer decodificador
 * em JavaScript.
 *
 * Se um dia o iPhone precisar ler código, é aqui que a biblioteca entra — as
 * telas conversam com este módulo, não com a API do navegador.
 */

/** Os formatos que uma etiqueta de produto usa no Brasil. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'] as const

interface DetectedBarcode {
  rawValue: string
  format: string
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats(): Promise<string[]>
}

function getConstructor(): BarcodeDetectorConstructor | null {
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector
  return typeof candidate === 'function' ? candidate : null
}

/**
 * A resposta é lembrada porque `getSupportedFormats` é assíncrono e nunca muda
 * dentro da mesma sessão — sem isso, cada barra de busca perguntaria de novo.
 */
let suporte: Promise<string[]> | null = null

/**
 * Formatos que este aparelho consegue ler, entre os que nos interessam.
 *
 * Lista vazia significa "não dá para ler aqui": ou o navegador não tem a API,
 * ou não há câmera, ou a página não está em contexto seguro — o navegador só
 * entrega a câmera em HTTPS (localhost conta).
 */
export function supportedBarcodeFormats(): Promise<string[]> {
  if (suporte) return suporte

  const Detector = getConstructor()
  const temCamera = Boolean(navigator.mediaDevices?.getUserMedia)

  suporte =
    !Detector || !temCamera || !window.isSecureContext
      ? Promise.resolve([])
      : Detector.getSupportedFormats()
          .then((disponiveis) => FORMATS.filter((f) => disponiveis.includes(f)))
          // Um navegador que anuncia a API mas falha ao consultá-la é o mesmo
          // que um sem a API: o que importa para a tela é não oferecer o botão.
          .catch(() => [])

  return suporte
}

export function createBarcodeDetector(formats: string[]): BarcodeDetectorLike | null {
  const Detector = getConstructor()
  return Detector ? new Detector({ formats }) : null
}

/**
 * Pede a câmera traseira.
 *
 * `ideal` e não `exact`: num notebook só existe a frontal, e exigir a traseira
 * faria a leitura falhar onde ela ainda funcionaria.
 */
export function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  })
}

/**
 * Mensagem para o motivo real da recusa.
 *
 * "Erro ao abrir a câmera" não diz o que fazer; negar a permissão e não ter
 * câmera pedem coisas diferentes de quem está na loja.
 */
export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ''

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'A permissão de câmera foi negada. Libere o acesso nas configurações do navegador e tente de novo.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Nenhuma câmera foi encontrada neste aparelho.'
  }
  if (name === 'NotReadableError') {
    return 'A câmera está em uso por outro aplicativo. Feche-o e tente de novo.'
  }
  return 'Não foi possível abrir a câmera. Digite o código na busca.'
}

/**
 * A lanterna (o flash) é uma capacidade da trilha de vídeo, e só aparece depois que a
 * câmera abriu. O Chrome do Android a expõe; o desktop e boa parte dos outros navegadores
 * não. `torch` não está nos tipos do TypeScript, por isso o molde próprio.
 */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }

/** Este aparelho acende a lanterna pela câmera aberta? Sem isso a tela não oferece o botão. */
export function supportsTorch(track: MediaStreamTrack): boolean {
  if (typeof track.getCapabilities !== 'function') return false
  return (track.getCapabilities() as TorchCapabilities).torch === true
}

/** Liga ou desliga a lanterna. Rejeita se o aparelho recusar: quem chama avisa a pessoa. */
export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
}
