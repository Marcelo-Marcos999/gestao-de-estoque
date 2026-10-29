import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

/**
 * Regras do projeto.
 *
 * As regras marcadas com "CLAUDE.md" transformam um combinado escrito em
 * checagem automática: elas falham na hora, sem depender de alguém lembrar.
 */
export default tseslint.config(
  // backend/ é outro projeto Node (Express/Postgres), com seu próprio
  // tsconfig e suas próprias dependências — não tem como o parser daqui
  // entender esses arquivos, e as regras desta config (tokens de cor,
  // localStorage, limite entre features) são todas sobre o front-end.
  { ignores: ['dist', 'node_modules', 'coverage', 'backend'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // --- CLAUDE.md, "Filtros e buscas são lembrados" --------------------
      // O acesso ao armazenamento precisa passar por shared/lib/storage.ts,
      // que trata storage bloqueado e registro corrompido. Chamar direto num
      // componente derruba a tela em navegador com dados de site bloqueados.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Use readJson/writeJson de @/shared/lib/storage (ver CLAUDE.md).',
        },
        {
          name: 'sessionStorage',
          message: 'Use readJson/writeJson de @/shared/lib/storage (ver CLAUDE.md).',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'Use readJson/writeJson de @/shared/lib/storage (ver CLAUDE.md).',
        },
        {
          object: 'window',
          property: 'sessionStorage',
          message: 'Use readJson/writeJson de @/shared/lib/storage (ver CLAUDE.md).',
        },
      ],

      // --- CLAUDE.md, "Arquitetura" ---------------------------------------
      // Uma feature nunca importa de dentro de outra: só do index.ts dela.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Importe apenas do index.ts da feature (@/features/nome) ou de shared/ (ver CLAUDE.md).',
            },
          ],
        },
      ],

      // --- CLAUDE.md, "Tamanho de arquivo e modularização" -----------------
      // Aviso, não erro: passar de 200 linhas de código é sinal de que há um
      // hook ou subcomponente querendo sair, não uma proibição.
      'max-lines': [
        'warn',
        { max: 200, skipBlankLines: true, skipComments: true },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // O módulo de storage é justamente quem tem permissão de tocar no
  // armazenamento — a regra existe para todo o resto.
  {
    files: ['src/shared/lib/storage.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },

  // Cada feature importa livremente os próprios arquivos por caminho relativo;
  // a restrição vale para o alias, que é como uma feature alcança a outra.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Arquivo longo por ser uma lista de dados está tudo bem — o problema que a
  // regra procura é lógica misturada, e aqui não há nenhuma (ver CLAUDE.md,
  // "Tamanho de arquivo e modularização").
  {
    files: ['src/shared/ui/icons.tsx', 'src/styles/**'],
    rules: { 'max-lines': 'off' },
  },
)
