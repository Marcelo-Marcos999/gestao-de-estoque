import type { EmailParaEnviar } from './enviar.js'

/**
 * Textos dos e-mails. Os links levam um token de uso único; o texto avisa o
 * prazo e diz o que fazer se a pessoa não pediu — quem recebe um e-mail desses
 * sem ter pedido precisa saber que pode ignorar.
 */

function montar(
  para: string,
  assunto: string,
  titulo: string,
  explicacao: string,
  botao: string,
  link: string,
  aviso: string,
): EmailParaEnviar {
  const texto = [titulo, '', explicacao, '', `${botao}: ${link}`, '', aviso].join('\n')

  const html = `<!doctype html>
<html lang="pt-BR"><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1c1c1e">
  <h2 style="margin:0 0 16px">${titulo}</h2>
  <p>${explicacao}</p>
  <p style="margin:24px 0">
    <a href="${link}" style="background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${botao}</a>
  </p>
  <p style="font-size:13px;color:#555">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${link}</p>
  <p style="font-size:13px;color:#555">${aviso}</p>
</body></html>`

  return { para, assunto, texto, html }
}

export function emailConfirmacao(para: string, link: string): EmailParaEnviar {
  return montar(
    para,
    'Confirme seu e-mail — Gestão de Validades',
    'Confirme seu e-mail',
    'Falta só um passo para ativar sua conta no Gestão de Validades.',
    'Confirmar e-mail',
    link,
    'Este link vale por 24 horas e só pode ser usado uma vez. Se você não criou uma conta, ignore esta mensagem: nada será ativado.',
  )
}

export function emailRedefinicaoDeSenha(para: string, link: string): EmailParaEnviar {
  return montar(
    para,
    'Redefinir sua senha — Gestão de Validades',
    'Redefinir sua senha',
    'Recebemos um pedido para criar uma nova senha na sua conta.',
    'Criar nova senha',
    link,
    'Este link vale por 1 hora e só pode ser usado uma vez. Se você não pediu, ignore esta mensagem: sua senha continua a mesma.',
  )
}
