import { useAppearance } from '../AppearanceContext'
import { ACCENTS, THEME_MODES } from '../theme'
import styles from './AppearancePanel.module.css'

/**
 * Tema e cor de destaque. Vale para este aparelho e fica gravado nele: é
 * preferência de quem usa, não da empresa — dois operadores na mesma loja
 * podem preferir temas diferentes.
 */
export function AppearancePanel() {
  const { mode, accent, setMode, setAccent } = useAppearance()

  return (
    <section className={styles.panel} aria-labelledby="appearance-title">
      <h2 className={styles.title} id="appearance-title">
        Aparência
      </h2>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Tema</legend>
        <div className={styles.options}>
          {THEME_MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.option} ${mode === option.value ? styles.selected : ''}`}
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Cor de destaque</legend>
        <div className={styles.options}>
          {ACCENTS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.option} ${accent === option.value ? styles.selected : ''}`}
              aria-pressed={accent === option.value}
              onClick={() => setAccent(option.value)}
              // O atributo faz a amostra ler o `--brand` DESTA cor, sem
              // escrever nenhum valor de cor aqui: as cores vivem nos tokens.
              data-accent-preview={option.value}
            >
              <span className={styles.swatch} aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
        <p className={styles.note}>
          As cores de validade (vencido, atenção, em dia, sem data) não mudam: elas carregam
          significado e continuam as mesmas em qualquer tema.
        </p>
      </fieldset>
    </section>
  )
}
