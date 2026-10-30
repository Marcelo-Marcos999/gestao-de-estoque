# Gestão de Validades — instruções do projeto

Ferramenta complementar ao ERP para controle de validade de produtos.

Também é **portfólio**: o autor está estudando para atuar como desenvolvedor
full stack. Na prática isso significa que o código é lido por gente avaliando
quem o escreveu — clareza vale tanto quanto funcionar, e uma solução simples e
bem explicada vale mais que uma esperta e obscura.

Consequência: o projeto não cita nenhuma empresa real. Dados de exemplo,
e-mails de teste e nomes de produto são fictícios.

## Comentários em português do Brasil

Todo comentário é escrito em **português do Brasil**, sem exceção.

Comente o **porquê**, não o quê. `// incrementa o contador` acima de `i++` é
ruído; o que ajuda é a razão que não está no código:

```ts
// Sem espera, cada tecla dispararia uma varredura de 26 mil registros.
const debouncedSearch = useDebouncedValue(filters.search, 250)
```

Registre também a decisão e o que ela evita — sobretudo quando o código parece
estranho à primeira vista. Quem lê daqui a seis meses (ou numa entrevista)
precisa entender por que aquilo está ali.

Continuam em inglês, por convenção da linguagem e das bibliotecas: nomes de
variáveis, funções, tipos, arquivos e chaves de objeto. O comentário explica;
o identificador nomeia.

## Regras permanentes de interface

Valem para **toda** tela criada neste projeto, sem exceção e sem precisar ser
repetidas a cada pedido:

1. **Responsiva.** Layout íntegro de 360px a 1440px. Mobile-first: escreva o
   layout estreito primeiro. Alvo de toque mínimo de 44×44px — o sistema é
   usado no corredor da loja, com celular na mão.
2. **Dark mode é o padrão**, com tema claro disponível. Uma tela de
   configurações permitirá trocar; até ela existir, a infraestrutura de tema já
   deve estar pronta.
3. **Cores personalizáveis.** Nenhum valor de cor escrito direto no CSS de
   componente. Tudo sai dos tokens em `src/styles/tokens.css`, para que trocar
   a identidade visual seja trocar valores de token, nunca reescrever CSS.

Consequência prática: um componente novo nunca declara `#hex`, `rgb()` ou
`hsl()`. Se falta um token para o que você precisa, crie o token.

## Perfis de acesso

Dois perfis, definidos em `features/auth/types.ts`:

| Perfil | Pode |
|---|---|
| `admin` | tudo: alimentar o cadastro de produtos (importar planilha, criar, editar, excluir), registrar quebras e administrar os logins da empresa (criar, desativar, gerar nova senha) |
| `operador` | registrar quebras e **consultar** produtos de dentro do registro — não altera a base |

O cadastro de produtos é a base que todo registro de quebra consulta, então
**todos leem**; só o administrador escreve. A tela do cadastro, porém, é do
administrador: o operador alcança os produtos pela busca dentro do registro, e
não por um item de menu (ver `docs/dominio.md`).

Uma tela que oferece uma ação que o perfil não pode executar é pior que não
oferecer: o usuário só descobre no erro. Esconda a ação, não a bloqueie no
clique.

A permissão também é verificada no servidor (`backend/src/auth/middleware.ts`
e Row Level Security no Postgres, ver `backend/migrations/`) — esconder o
botão aqui é experiência, não segurança; quem garante a regra é o back-end.

## Filtros e buscas são lembrados

Todo filtro, busca, ordenação ou aba selecionada é gravado em `localStorage`
e restaurado ao abrir o app. Quem fechou o sistema no meio de uma conferência
volta exatamente onde estava, sem refazer a seleção.

Use `usePersistedState` (em `shared/hooks/`) — ele já trata storage bloqueado e
registro corrompido. Nunca chame `localStorage` direto num componente.

Contrapartida obrigatória: um filtro restaurado precisa ser **visível e fácil de
desfazer**. Uma lista filtrada que parece a lista inteira é pior do que não
lembrar nada — mostre o que está ativo e ofereça um jeito de limpar.

## Semântica de cor de validade

Estas cores carregam significado de negócio e **não** podem ser reusadas como
decoração:

| Token | Significado |
|---|---|
| `--expired` | já passou da data |
| `--warning` | dentro do prazo de alerta |
| `--ok` | gira antes de vencer |
| `--unknown` | sem data cadastrada |

Nunca comunique estado só por cor: acompanhe ícone ou texto.

## Arquitetura

Organização por **feature**, não por tipo de arquivo. Uma feature nunca importa
de dentro de outra — só do `index.ts` dela ou de `shared/`.

```
src/
  app/        rotas, guarda de sessão, layout geral
  features/   auth/, products/ ...
  shared/     ui/ (design system), lib/ (helpers puros)
  styles/     tokens.css, global.css
backend/      API (Express + Postgres) — projeto Node separado, com seu
              próprio package.json; não entra no lint/typecheck do front-end
              (ver eslint.config.js) nem compartilha dependências com ele
```

## Tamanho de arquivo e modularização

Arquivo grande é caro de ler e de manter. Diretrizes, não dogma:

- **Componente acima de ~150 linhas** ou com 3+ responsabilidades: quebre por
  **comportamento**, não por tamanho. Um assistente de várias etapas vira uma
  etapa por arquivo, mais um hook com a máquina de estados.
- **Lógica sai do componente.** Busca de dados, validação e transformação vão
  para hooks ou funções puras; o componente cuida de desenhar.
- **Se dois lugares repetem a mesma lógica**, ela vira um módulo em `shared/`.
- Um arquivo longo por ser uma lista de dados (ícones, tokens, tabela de
  constantes) está tudo bem — o problema é lógica misturada, não linhas.

Ao terminar uma feature, olhe os arquivos que ela criou: se algum passou de
~200 linhas, provavelmente há um hook ou um subcomponente querendo sair.

## Domínio

O que o sistema precisa fazer, e por quê, está em [`docs/dominio.md`](docs/dominio.md):
alcance (quebra de estoque, não só validade), produto pendente de cadastro,
registro repetido e o que veio do AppSheet como contorno e não se repete aqui.

O modelo de dados (tabelas, relações, o que acontece ao apagar, RLS e índices)
está em [`docs/modelo-de-dados.md`](docs/modelo-de-dados.md), com o diagrama
editável em [`docs/schema.dbml`](docs/schema.dbml). A fonte da verdade continua
sendo `backend/migrations/`: mexeu no banco, atualize os dois.

## Estado do back-end

Existe, em `backend/`: Express + Postgres (Neon), autenticação por JWT
(acesso curto + refresh) e Row Level Security no banco — toda query roda sob
uma role sem privilégio de dono, e as políticas de RLS são o filtro real
entre contas e lojas, não o código da rota (ver `backend/migrations/`).

Nem toda feature já fala com ele. `auth`, `products`, `expiry` (lotes),
`breakage` (registros, motivos e origens) e a leitura de números em `stock` já
chamam o back-end de verdade. Falta guardar os **arquivos** dos anexos de
quebra, que dependem de um armazenamento de arquivos que ainda não existe: o
registro persiste, a foto não.

Criar conta, confirmar e-mail e "esqueci a senha" dependem de um provedor de
e-mail (`EMAIL_PROVEDOR` em `backend/.env.example`) que ainda não está ligado em
produção, e a tela de login esconde essas opções enquanto ele não existe. Até lá,
o administrador cria os logins e as senhas provisórias em Configurações. Em qualquer um dos dois
casos, cada feature isola o acesso a dados no próprio `api.ts` — migrar uma
feature pro back-end real é mexer só nesse arquivo, nunca na tela.

## Checagem automática dos padrões

Parte das regras acima é verificada por máquina, não por memória. `npm run
lint` roda antes de todo commit (hook em `.githooks/pre-commit`, ativado
sozinho pelo `npm install`) e falha se:

| Regra | O que reprova | Onde está configurada |
|---|---|---|
| Cor fora de token | `#hex`, `rgb()`, `hsl()` em CSS de componente | `stylelint.config.js` |
| Storage direto | `localStorage`/`sessionStorage` fora de `shared/lib/storage.ts` | `eslint.config.js` |
| Acoplamento entre features | importar `@/features/x/algo` em vez de `@/features/x` | `eslint.config.js` |
| Arquivo grande | acima de 200 linhas de código (aviso) | `eslint.config.js` |

O que **não** dá para automatizar continua valendo e depende de julgamento:
responsividade real, dark mode conferido nos dois temas, filtro restaurado
visível e fácil de desfazer, e cor nunca sendo o único sinal de estado.

Para pular a checagem numa emergência: `git commit --no-verify`.

## Comandos

```bash
npm run dev         # desenvolvimento (front-end)
npm run build       # build de produção
npm run lint        # tipos + código + CSS (o que o hook roda)
npm run lint:types  # só TypeScript
npm run lint:code   # só ESLint
npm run lint:css    # só Stylelint
```

O back-end é outro projeto, dentro de `backend/`, com seu próprio
`package.json` (`cd backend && npm install`). Variáveis de ambiente em
`backend/.env.example` — nunca em `backend/.env`, que não entra no git.
