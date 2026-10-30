import { MIN_PASSWORD_LENGTH } from '@/shared/lib/validation'
import { CheckIcon } from '@/shared/ui/icons'
import styles from './authForm.module.css'

/**
 * Lista do que a senha nova precisa ter, acendendo cada item conforme a pessoa
 * digita. Mostrar a regra antes do erro evita o "senha inválida" sem explicação.
 * Usada em tudo que cria senha (criar conta, redefinir).
 */
export function PasswordRequirements({ password }: { password: string }) {
  // Derivado da senha a cada render: é barato, e guardar em estado criaria uma
  // segunda cópia pra manter sincronizada.
  const requirements = [
    { label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`, met: password.length >= MIN_PASSWORD_LENGTH },
    { label: 'Uma letra', met: /[a-zA-Z]/.test(password) },
    { label: 'Um número', met: /[0-9]/.test(password) },
  ]

  return (
    <ul className={styles.requirements}>
      {requirements.map((requirement) => (
        <li
          key={requirement.label}
          className={`${styles.requirement} ${requirement.met ? styles.requirementMet : ''}`}
        >
          <span className={styles.requirementDot}>
            {requirement.met ? <CheckIcon width={16} height={16} /> : '•'}
          </span>
          {requirement.label}
        </li>
      ))}
    </ul>
  )
}
