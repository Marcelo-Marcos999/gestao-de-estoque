# Gestão de Validades

Controle de **validade de produtos** para lojas cujo ERP não tem esse recurso.
Importa a planilha exportada do ERP, reconhece as colunas sozinho, traz apenas os
produtos que ainda não existem no cadastro e sinaliza o que está vencido ou perto
de vencer.

Feito com React, TypeScript e Vite, sem framework de UI: o design system é próprio.

## Estado atual

Em construção. Front-end primeiro, regras de negócio depois.

| Etapa | Situação |
|---|---|
| Autenticação (login, recuperação de senha) | pronta |
| Cadastro de produtos, com busca em 26 mil registros | pronto |
| Importação de planilha (.xlsx e .csv) | pronta |
| Temas escuro e claro, com acento trocável | pronto |
| Painel de validades, com as quatro situações | pronto |
| Registro de quebra, com motivos, origens e anexos | pronto |
| Tela de estoque: saldo, saídas, custo e venda | pronta |
| Leitura de código de barras pela câmera | pronta |
| Exportação para .xlsx com os filtros da tela | pronta |
| Tela de configurações | a fazer |
| Envio de alerta por e-mail | a fazer |

> **Sem back-end ainda.** Cada feature isola o acesso a dados no seu `api.ts`, hoje
> resolvido em memória, para as telas serem construídas e validadas antes do servidor
> existir. Quando ele existir, só esses arquivos mudam.

## Pontos técnicos que valem uma olhada

| Onde | O quê |
|---|---|
| `shared/lib/spreadsheet/` | Leitor próprio de `.xlsx`, sobre `fflate` mais o interpretador de XML do navegador. A biblioteca mais usada tem prototype pollution e ReDoS na versão publicada no npm, e as alternativas trazem dependência vulnerável |
| `shared/lib/spreadsheet/csv.ts` | CSV tolerante ao que sai de ERP brasileiro: separador por ponto e vírgula, codificação Windows-1252 e campos entre aspas |
| `features/products/import/columns.ts` | Reconhece as colunas pelo cabeçalho e, quando ele não basta, pelo conteúdo — 13 dígitos indicam código de barras |
| `features/products/components/ProductsTable.tsx` | Lista virtualizada que mede a própria linha: 26 mil produtos com cerca de 20 nós no DOM |
| `styles/tokens.css` | Toda cor, espaço e tipografia. Trocar tema ou identidade visual é trocar valores aqui |

## Rodando

```bash
npm install
npm run dev
```

Contas de teste: `admin@exemplo.com.br` ou `operador@exemplo.com.br`, senha `senha123`.

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção em `dist/` |
| `npm run lint` | tipos, código e CSS — o mesmo que roda antes de cada commit |

## Estrutura

Organizada por **feature**, não por tipo de arquivo. Uma feature nunca importa de dentro
de outra — só do `index.ts` dela ou de `shared/`.

```
src/
  app/          rotas, guarda de sessão, layout geral
  features/
    auth/       login, recuperação de senha, sessão
    products/   cadastro de produtos (do administrador)
    stock/      saldo, saídas, custo e venda (dos dois perfis)
    expiry/     acompanhamento de validades
    breakage/   registro de quebra
    settings/   tema e período do relatório de saídas
  shared/
    ui/         design system (Button, TextField, Alert, Logo)
    lib/        helpers puros, sem React
  styles/       tokens.css (vocabulário visual) + global.css
```

## Decisões de design

**A faixa de validade** é a assinatura visual do produto: uma barra que traduz dias
restantes em cor. Aparece no logo e vai se repetir nos cards e linhas de produto, de
modo que a cor sempre signifique a mesma coisa em qualquer tela.

| Cor | Significado |
|---|---|
| vermelho `--expired` | já passou da data |
| âmbar `--warning` | dentro do prazo de alerta |
| verde `--ok` | gira antes de vencer |
| cinza `--unknown` | sem data cadastrada |

Essas cores carregam significado de negócio e não devem ser reusadas como decoração.
Todo valor de cor, espaço e tipografia vem de `src/styles/tokens.css` — nada de valor
mágico solto no CSS.

### Autenticação

- A mensagem de erro é a mesma para e-mail inexistente e senha errada, e a recuperação
  confirma o envio mesmo quando a conta não existe. Revelar a diferença transformaria as
  telas em uma forma de descobrir quais e-mails estão cadastrados.
- O formulário nunca é limpo depois de um erro.
- "Manter conectado" vem ligado: é uso interno e diário.
