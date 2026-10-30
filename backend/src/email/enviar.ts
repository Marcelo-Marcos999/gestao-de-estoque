/**
 * Envio de e-mail, isolado do resto do back-end.
 *
 * As rotas só conhecem `enviarEmail` e `envioDeEmailAtivo`; qual serviço está
 * por trás é decidido aqui, por variável de ambiente. Trocar de provedor é
 * mexer neste arquivo, não nas rotas.
 *
 * Sem provedor configurado, o envio simplesmente NÃO está ativo, e as rotas
 * que dependem dele respondem 503 em vez de fingir que mandaram. Fingir seria
 * pior: a pessoa esperaria pra sempre um e-mail que nunca vai chegar.
 */

export interface EmailParaEnviar {
  para: string
  assunto: string
  texto: string
  html: string
}

type Provedor = 'resend' | 'console'

function provedorEscolhido(): Provedor | null {
  const escolhido = process.env.EMAIL_PROVEDOR

  // `console` só escreve o e-mail no log, pra desenvolver sem provedor. Nunca
  // em produção: o log de um servidor não é caixa de entrada, e o link de
  // recuperação de senha é uma credencial.
  if (escolhido === 'console' && process.env.NODE_ENV !== 'production') return 'console'

  if (escolhido === 'resend' && process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE) {
    return 'resend'
  }

  return null
}

/**
 * Endereço do app, usado nos links dos e-mails. Vem de configuração e nunca do
 * cabeçalho `Host`/`Origin` da requisição: quem controla esse cabeçalho
 * controlaria pra onde o link de redefinir senha aponta.
 */
export function urlDoApp(): string | null {
  const url = process.env.APP_URL?.trim().replace(/\/+$/, '')
  return url ? url : null
}

export function envioDeEmailAtivo(): boolean {
  return provedorEscolhido() !== null && urlDoApp() !== null
}

export async function enviarEmail(email: EmailParaEnviar): Promise<void> {
  const provedor = provedorEscolhido()

  if (provedor === 'console') {
    console.log(`[e-mail simulado] para=${email.para} assunto="${email.assunto}"\n${email.texto}`)
    return
  }

  if (provedor === 'resend') {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_REMETENTE,
        to: [email.para],
        subject: email.assunto,
        text: email.texto,
        html: email.html,
      }),
    })

    // Só o status vai pro erro: o corpo da resposta e o do pedido têm o link.
    if (!resposta.ok) throw new Error(`Resend respondeu ${resposta.status}`)
    return
  }

  throw new Error('Nenhum provedor de e-mail configurado.')
}
