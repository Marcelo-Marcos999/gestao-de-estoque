import { useEffect, useRef, useState } from 'react'
import { Alert } from './Alert'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { BoltIcon } from './icons'
import {
  cameraErrorMessage,
  createBarcodeDetector,
  openCamera,
  setTorch,
  supportsTorch,
} from '../lib/barcode'
import styles from './BarcodeScanner.module.css'

interface BarcodeScannerProps {
  open: boolean
  formats: string[]
  onClose: () => void
  onDetect: (code: string) => void
}

/** Entre duas leituras: a câmera entrega 30 quadros por segundo e ler todos
 *  esquentaria o aparelho sem achar nada que 8 por segundo não achem. */
const INTERVALO_MS = 120

export function BarcodeScanner({ open, formats, onClose, onDetect }: BarcodeScannerProps) {
  if (!open) return null
  return <Scanner formats={formats} onClose={onClose} onDetect={onDetect} />
}

/**
 * A câmera lendo o código.
 *
 * Montado só enquanto aberto: assim a câmera é ligada na abertura e desligada
 * na saída pelo próprio ciclo do componente, sem um efeito vigiando `open`
 * para adivinhar quando parar. Câmera que fica ligada depois de fechada é o
 * pior defeito possível aqui — a luz acesa no bolso de quem usa.
 */
function Scanner({ formats, onClose, onDetect }: Omit<BarcodeScannerProps, 'open'>) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)

  // A lanterna é da trilha de vídeo da câmera aberta. `torchTrack` só existe quando o
  // aparelho a oferece: sem ela, o botão nem aparece (ver CLAUDE.md: não oferecer o que
  // falharia no clique).
  const [torchTrack, setTorchTrack] = useState<MediaStreamTrack | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchError, setTorchError] = useState(false)

  async function toggleTorch() {
    if (!torchTrack) return
    setTorchError(false)
    try {
      await setTorch(torchTrack, !torchOn)
      setTorchOn(!torchOn)
    } catch {
      setTorchError(true)
    }
  }

  // A função mais recente, para o laço de leitura não precisar reiniciar a
  // câmera toda vez que a tela redesenha e passa uma função nova. A escrita
  // acontece em efeito, e não no corpo do render: durante o render o React
  // pode descartar o resultado, e a escrita ficaria perdida.
  const onDetectRef = useRef(onDetect)
  useEffect(() => {
    onDetectRef.current = onDetect
  })

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | null = null
    let cancelled = false

    const parar = () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }

    const detector = createBarcodeDetector(formats)

    openCamera()
      .then(async (aberto) => {
        stream = aberto
        if (cancelled || !videoRef.current) {
          aberto.getTracks().forEach((t) => t.stop())
          return
        }

        videoRef.current.srcObject = aberto
        await videoRef.current.play()
        if (cancelled) return
        setLendo(true)

        const track = aberto.getVideoTracks()[0]
        if (track && supportsTorch(track)) setTorchTrack(track)

        const procurar = async () => {
          if (cancelled || !videoRef.current || !detector) return

          try {
            const encontrados = await detector.detect(videoRef.current)
            const codigo = encontrados[0]?.rawValue?.trim()
            if (codigo) {
              parar()
              onDetectRef.current(codigo)
              return
            }
          } catch {
            // Um quadro que falhou não é motivo para desistir: acontece quando
            // o vídeo ainda não tem imagem. O próximo tenta de novo.
          }

          timer = window.setTimeout(() => void procurar(), INTERVALO_MS)
        }

        void procurar()
      })
      .catch((causa: unknown) => {
        if (!cancelled) setErro(cameraErrorMessage(causa))
      })

    return parar
  }, [formats])

  return (
    <Dialog
      open
      onClose={onClose}
      title="Ler código de barras"
      anchor="top"
      subtitle="Aponte a câmera para o código da etiqueta."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      {erro ? (
        <Alert tone="danger">{erro}</Alert>
      ) : (
        <>
          <div className={styles.frame}>
            <video ref={videoRef} className={styles.video} playsInline muted />

            {/* A faixa fica NO ALTO da imagem, e a folha no alto da tela: a câmera traseira
                fica no topo do aparelho, então o código é apontado na mesma direção dela,
                em vez de lá embaixo, no meio da tela. A leitura olha a imagem toda; a faixa
                só orienta onde pôr o código. */}
            <span className={styles.aim} aria-hidden="true" />

            {/* Estado e lanterna na mesma linha: lado a lado nunca se sobrepõem, mesmo a 360px. */}
            <div className={styles.bar}>
              <span className={styles.hint} role="status">
                {lendo ? 'Procurando…' : 'Abrindo…'}
              </span>

              {torchTrack && (
                <button
                  type="button"
                  className={styles.torch}
                  aria-pressed={torchOn}
                  onClick={() => void toggleTorch()}
                >
                  <BoltIcon width={18} height={18} />
                  <span>{torchOn ? 'Lanterna ligada' : 'Lanterna'}</span>
                </button>
              )}
            </div>
          </div>
          {torchError && (
            <Alert tone="danger">Não foi possível acender a lanterna neste aparelho.</Alert>
          )}
        </>
      )}
    </Dialog>
  )
}
