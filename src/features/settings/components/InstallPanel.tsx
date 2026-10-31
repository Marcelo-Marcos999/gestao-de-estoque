import { useState } from 'react'
import { promptInstall, useInstallState } from '@/shared/pwa/install'
import { Button } from '@/shared/ui/Button'
import { CheckIcon, PlusIcon } from '@/shared/ui/icons'
import styles from './InstallPanel.module.css'

/**
 * Instalar o sistema como aplicativo: ícone na tela inicial (celular) ou na
 * área de trabalho (computador), abrindo em janela própria, sem barra de
 * endereço. É o mesmo site — nada a baixar de loja de aplicativos.
 *
 * O texto muda conforme o que o navegador permite, porque "toque em Instalar"
 * numa tela sem botão de instalar é o tipo de instrução que só confunde.
 */
export function InstallPanel() {
  const state = useInstallState()
  const [declined, setDeclined] = useState(false)

  async function install() {
    const accepted = await promptInstall()
    setDeclined(!accepted)
  }

  return (
    <section className={styles.panel} aria-labelledby="install-title">
      <h2 className={styles.title} id="install-title">
        Aplicativo
      </h2>

      {state === 'instalado' && (
        <p className={styles.done} role="status">
          <CheckIcon width={18} height={18} aria-hidden="true" />
          Você já está usando o aplicativo instalado.
        </p>
      )}

      {state === 'disponivel' && (
        <>
          <p className={styles.text}>
            Instale para abrir direto do ícone, em janela própria, como qualquer outro aplicativo.
            No celular fica na tela inicial; no computador, na área de trabalho ou no menu
            Iniciar.
          </p>
          <div>
            <Button onClick={install}>
              <PlusIcon width={18} height={18} aria-hidden="true" />
              Instalar aplicativo
            </Button>
          </div>
          {declined && (
            <p className={styles.note} role="status">
              A instalação não foi concluída. Você pode tentar de novo quando quiser.
            </p>
          )}
        </>
      )}

      {state === 'ios' && (
        <>
          <p className={styles.text}>
            No iPhone e no iPad a instalação é manual, e só funciona pelo Safari:
          </p>
          <ol className={styles.steps}>
            <li>Toque no botão de compartilhar, o quadrado com a seta para cima.</li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>
              Toque em <strong>Adicionar</strong>.
            </li>
          </ol>
        </>
      )}

      {state === 'indisponivel' && (
        <>
          <p className={styles.text}>
            Este navegador não ofereceu a instalação agora. Tente assim:
          </p>
          <ul className={styles.steps}>
            <li>
              <strong>Computador:</strong> no Chrome ou no Edge, clique no ícone de instalar no
              fim da barra de endereço, ou abra o menu e escolha Instalar.
            </li>
            <li>
              <strong>Android:</strong> no Chrome, menu (três pontos) e Instalar aplicativo.
            </li>
            <li>
              <strong>Mac:</strong> no Safari, menu Arquivo e Adicionar ao Dock.
            </li>
          </ul>
          <p className={styles.note}>
            Se já instalou, abra pelo ícone: esta aba continua sendo só o site. O Firefox no
            computador não instala aplicativos.
          </p>
        </>
      )}

      <p className={styles.note}>
        O aplicativo precisa de internet para mostrar e salvar os dados: sem conexão ele abre, mas
        não consegue carregar nada.
      </p>
    </section>
  )
}
