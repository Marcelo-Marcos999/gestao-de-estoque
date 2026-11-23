/**
 * O "bip" de confirmação do leitor de código de barras.
 *
 * Gerado na hora pela Web Audio API, e não tocado de um arquivo de som: não há
 * arquivo para baixar, para guardar no cache do app instalado nem para o
 * navegador decodificar na hora H, e o som é curto o bastante para não precisar
 * de gravação. Quem lê o código no corredor precisa ouvir que "pegou" sem olhar
 * para a tela — com o celular na altura da prateleira, a tela nem está à vista.
 */

/**
 * Um contexto só, para a página inteira. Criar um por bip esgotaria o limite do
 * navegador (cerca de seis abertos ao mesmo tempo no Chrome) depois de poucas
 * leituras, e o som pararia sem erro nenhum.
 */
let contexto: AudioContext | null = null

function obterContexto(): AudioContext | null {
  if (contexto) return contexto

  // O Safari antigo só tem a versão com prefixo.
  const Construtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Construtor) return null

  try {
    contexto = new Construtor()
  } catch {
    // Sem áudio neste aparelho: ler o código continua funcionando, só sem som.
    contexto = null
  }
  return contexto
}

/**
 * Deixa o som pronto. Chamar dentro de um toque do usuário (o botão de ler).
 *
 * O navegador só libera áudio depois de uma interação da pessoa. O bip toca uns
 * segundos depois do toque, quando a câmera acha o código — fora de qualquer
 * toque —, e um contexto criado só nessa hora nasceria suspenso, mudo. Criar e
 * retomar aqui, no gesto, é o que garante que o bip saia.
 */
export function prepareBeep(): void {
  const ctx = obterContexto()
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
}

/** Frequência e duração de um bip de leitor de supermercado: agudo e curto. */
const FREQUENCIA_HZ = 1800
const DURACAO_S = 0.12
const VOLUME = 0.25

/**
 * Toca o bip. Nunca lança erro e nunca espera: o som é um complemento, e uma
 * falha dele não pode atrasar nem impedir a leitura que o originou.
 */
export function playBeep(): void {
  const ctx = obterContexto()
  if (!ctx) return

  try {
    // Aba que ficou muito tempo em segundo plano pode ter suspendido o contexto.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})

    const oscilador = ctx.createOscillator()
    const ganho = ctx.createGain()
    oscilador.type = 'square'
    oscilador.frequency.value = FREQUENCIA_HZ

    // Subida e descida rápidas do volume: ligar e desligar o som de uma vez
    // produz um "clique" audível no começo e no fim do bip.
    const agora = ctx.currentTime
    ganho.gain.setValueAtTime(0, agora)
    ganho.gain.linearRampToValueAtTime(VOLUME, agora + 0.01)
    ganho.gain.setValueAtTime(VOLUME, agora + DURACAO_S - 0.02)
    ganho.gain.linearRampToValueAtTime(0, agora + DURACAO_S)

    oscilador.connect(ganho)
    ganho.connect(ctx.destination)
    oscilador.start(agora)
    oscilador.stop(agora + DURACAO_S)
  } catch {
    // Mesma razão: sem som, a leitura segue.
  }
}
