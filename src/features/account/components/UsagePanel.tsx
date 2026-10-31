import { Alert } from '@/shared/ui/Alert'
import { Progress } from '@/shared/ui/Progress'
import type { Company } from '../types'
import styles from './panel.module.css'

const BYTES_PER_MB = 1024 * 1024

/** A partir daqui a tela avisa; esperar chegar a 100% é avisar tarde, quando o trabalho já parou. */
const WARN_FROM = 0.8

type Level = 'ok' | 'near' | 'full'

function levelOf(used: number, limit: number | null): Level {
  if (limit === null || limit <= 0) return limit === 0 ? 'full' : 'ok'
  if (used >= limit) return 'full'
  return used / limit >= WARN_FROM ? 'near' : 'ok'
}

/**
 * Quanto do plano a empresa já usa: registros e arquivos.
 *
 * Os números são da conta inteira. O operador de uma loja só enxerga os
 * registros da dele, mas o limite é de todas juntas; é por isso que o consumo
 * vem do servidor e não de contar a lista que a tela tem na mão.
 *
 * Sem limite (nulo) a barra não faz sentido e some: fica só o consumo.
 */
export function UsagePanel({ company }: { company: Company }) {
  const filesUsedMb = company.filesUsedBytes / BYTES_PER_MB
  const records = levelOf(company.recordsUsed, company.recordLimit)
  const files = levelOf(filesUsedMb, company.storageLimitMb)

  return (
    <section className={styles.panel} aria-labelledby="usage-title">
      <h2 className={styles.title} id="usage-title">
        Uso do plano
      </h2>

      {company.recordLimit === null ? (
        <p className={styles.text}>
          Registros: {company.recordsUsed.toLocaleString('pt-BR')} (sem limite)
        </p>
      ) : (
        <Progress label="Registros" value={company.recordsUsed} max={company.recordLimit} />
      )}

      {company.storageLimitMb === null ? (
        <p className={styles.text}>Arquivos: {formatMb(filesUsedMb)} MB (sem limite)</p>
      ) : (
        // Em MB com duas casas: uma foto reduzida pesa centenas de KB, e "0 de 1.024"
        // faria parecer que nada foi enviado.
        <Progress
          label="Arquivos (MB)"
          value={Math.round(filesUsedMb * 100) / 100}
          max={company.storageLimitMb}
        />
      )}

      {(records === 'full' || files === 'full') && (
        <Alert tone="danger">
          O limite do plano foi atingido: novos {records === 'full' ? 'registros' : 'arquivos'} são
          recusados até liberar espaço. Excluir o que não se usa mais resolve, ou fale com o suporte.
        </Alert>
      )}
      {records !== 'full' && files !== 'full' && (records === 'near' || files === 'near') && (
        // `info` e não um tom de alerta amarelo: as cores de validade carregam significado
        // de negócio (ver CLAUDE.md) e não servem para avisar de plano. O "Atenção"
        // no texto é o que sinaliza, não a cor.
        <Alert tone="info">
          Atenção: o uso passou de 80% do limite. Quando chegar a 100%, novos{' '}
          {records === 'near' ? 'registros' : 'arquivos'} deixam de ser aceitos.
        </Alert>
      )}
    </section>
  )
}

function formatMb(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}
