import { Button } from '@/shared/ui/Button'
import type { PlatformCompany } from '../types'
import styles from './CompanyCard.module.css'

interface CompanyCardProps {
  company: PlatformCompany
  onEditLimits: () => void
  onDelete: () => void
}

const BYTES_PER_MB = 1024 * 1024

function ofLimit(used: string, limit: number | null): string {
  return limit === null ? `${used} · sem limite` : `${used} de ${limit.toLocaleString('pt-BR')}`
}

/**
 * Uma empresa na lista. Cartão e não linha de tabela: no celular a tabela viraria
 * rolagem lateral, e o que importa aqui (quem é, quanto usa, o que fazer) cabe
 * empilhado. Cor nunca carrega o estado sozinha: o aviso de "no limite" tem texto.
 */
export function CompanyCard({ company, onEditLimits, onDelete }: CompanyCardProps) {
  const filesLabel = (company.filesUsedBytes / BYTES_PER_MB).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const filesText =
    company.storageLimitMb === null
      ? `${filesLabel} MB · sem limite`
      : `${filesLabel} de ${company.storageLimitMb.toLocaleString('pt-BR')} MB`
  const atUserLimit = company.userLimit !== null && company.activeUsers >= company.userLimit

  return (
    <li className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.name}>{company.name}</h2>
        <span className={styles.meta}>
          {company.adminEmail ?? 'sem administrador'} · criada em{' '}
          {new Date(company.createdAt).toLocaleDateString('pt-BR')}
        </span>
      </header>

      <dl className={styles.facts}>
        <dt>Logins ativos</dt>
        <dd>
          {ofLimit(company.activeUsers.toLocaleString('pt-BR'), company.userLimit)}
          {atUserLimit && <strong className={styles.flag}> · no limite</strong>}
          {company.totalUsers > company.activeUsers && ` (${company.totalUsers - company.activeUsers} desativados)`}
        </dd>
        <dt>Registros</dt>
        <dd>{ofLimit(company.recordsUsed.toLocaleString('pt-BR'), company.recordLimit)}</dd>
        <dt>Arquivos</dt>
        <dd>
          {filesText}
        </dd>
      </dl>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onEditLimits}>
          Ajustar limites
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Excluir empresa
        </Button>
      </div>
    </li>
  )
}
