import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '@/shared/lib/http'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { renameCompany } from '../api'
import { useCompany } from '../hooks/useCompany'
import { UsagePanel } from './UsagePanel'
import styles from './panel.module.css'

function limitText(value: number | null, unit: string): string {
  return value === null ? 'Sem limite' : `${value.toLocaleString('pt-BR')} ${unit}`
}

/** Nome da empresa (editável) e o que o plano permite (só leitura: plano e limites são da plataforma). */
export function CompanyPanel() {
  const { company, status, reload, refresh } = useCompany()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (status === 'loading') return <p className={styles.text}>Carregando…</p>
  if (status === 'error' || !company) {
    return (
      <section className={styles.panel}>
        <Alert tone="danger">Não foi possível carregar os dados da empresa.</Alert>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={reload}>
            Tentar de novo
          </Button>
        </div>
      </section>
    )
  }

  // Sem digitar nada, o campo mostra o nome gravado; `draft` só existe depois
  // da primeira tecla, para não precisar copiar o nome para o estado ao carregar.
  const name = draft ?? company.name
  const changed = name.trim() !== company.name

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('O nome é curto demais.')
      return
    }

    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      await renameCompany(name.trim())
      // Sem passar por "carregando": a tela não pode piscar logo depois de salvar.
      await refresh()
      setDraft(null)
      setSaved(true)
    } catch (erro) {
      setError(erro instanceof ApiError ? erro.message : 'Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className={styles.panel} aria-labelledby="company-name-title">
        <h2 className={styles.title} id="company-name-title">
          Empresa
        </h2>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success">Nome atualizado.</Alert>}

          <TextField
            label="Nome da empresa"
            name="organization"
            value={name}
            onChange={(event) => {
              setDraft(event.target.value)
              setSaved(false)
              setError(null)
            }}
            autoComplete="organization"
            required
          />

          <div className={styles.actions}>
            <Button type="submit" loading={saving} disabled={!changed}>
              {saving ? 'Salvando…' : 'Salvar nome'}
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="plan-title">
        <h2 className={styles.title} id="plan-title">
          Plano
        </h2>
        <p className={styles.text}>
          O plano e os limites são definidos pela plataforma. Precisa de mais logins, registros ou
          espaço para arquivos? Fale com o suporte.
        </p>
        <dl className={styles.facts}>
          <dt>Plano</dt>
          <dd>{company.plan === 'padrao' ? 'Padrão' : company.plan}</dd>
          <dt>Logins ativos</dt>
          <dd>
            {company.activeUsers.toLocaleString('pt-BR')}
            {company.userLimit !== null && ` de ${company.userLimit.toLocaleString('pt-BR')}`}
          </dd>
          <dt>Limite de logins</dt>
          <dd>{limitText(company.userLimit, company.userLimit === 1 ? 'login' : 'logins')}</dd>
          <dt>Limite de registros</dt>
          <dd>{limitText(company.recordLimit, 'registros')}</dd>
          <dt>Limite de arquivos</dt>
          <dd>{limitText(company.storageLimitMb, 'MB')}</dd>
        </dl>
      </section>

      <UsagePanel company={company} />
    </>
  )
}
