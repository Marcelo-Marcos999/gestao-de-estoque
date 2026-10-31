# Backup do banco

O Neon guarda só **6 horas** de histórico para voltar no tempo
(`history_retention_seconds = 21600`). Um erro descoberto no dia seguinte — uma
importação errada, um "Excluir tudo" por engano, uma conta apagada — não teria
volta. Este documento descreve a cópia diária que cobre essa lacuna e como
recuperar dela.

## Como funciona

Um fluxo do GitHub Actions (`.github/workflows/backup-banco.yml`) roda todo dia às
03:17 (São Paulo) e também sob demanda. Em cada execução:

1. **Dump** do banco inteiro com `pg_dump` (formato custom, já comprimido), usando
   um login **só de leitura** (`backup_leitor`).
2. **Confere** o arquivo: tamanho mínimo e os dados das tabelas obrigatórias
   presentes (`comum.sh`, `TABELAS_OBRIGATORIAS`).
3. **Criptografa** com AES-256 (`gpg`). O dump tem hash de senha e e-mail de todo
   mundo; só o arquivo cifrado sai do runner.
4. **Envia** ao bucket `gestao-validades-backups` do R2, em
   `diario/gestao-AAAAMMDD-HHMMSS.dump.gpg`.
5. **Restaura de teste**: baixa o que acabou de enviar, descriptografa, restaura
   num Postgres descartável e compara com a origem — políticas de RLS, índices,
   tabelas com RLS forçado, funções do `app_definer` (exatas) e contagem de linhas
   por tabela (até 1% de diferença, porque o banco segue recebendo gravações).
6. **Retenção**, só se tudo acima deu certo: ficam os 7 mais recentes, tudo dos
   últimos 30 dias e o primeiro de cada mês por 12 meses.

> **Por que restaurar a cada backup.** Um backup que nunca foi restaurado é uma
> esperança, não um backup. O passo 5 usa o arquivo que foi para o R2, então prova
> o caminho inteiro (envio, criptografia, formato) e não só que o dump rodou.

Os scripts estão em `backend/scripts/backup/` e rodam igual no computador:
`fazer-backup.sh`, `testar-restauracao.sh`, `aplicar-retencao.sh`, `restaurar.sh`
e o `r2.mjs`, que fala com o bucket.

### Decisões que parecem estranhas

- **O dump mantém os donos dos objetos** (não usa `--no-owner`). As funções de
  criar conta e redefinir senha são `SECURITY DEFINER` e pertencem ao
  `app_definer`; sem o dono certo elas passariam a rodar como o administrador do
  banco, **fora** do RLS. O teste de restauração conta essas funções para pegar
  isso.
- **Bucket e chave próprios**, separados dos anexos. Quem consegue apagar um anexo
  (a chave que está no Render) não deve conseguir apagar o backup.
- **Login `backup_leitor`** em vez do dono do banco: se o segredo vazar, dá para
  ler, mas não apagar nem alterar nada. Ele precisa de `BYPASSRLS`, senão o
  `pg_dump` enxergaria zero linhas das tabelas com RLS forçado (o próprio
  `pg_dump` recusa e falha, em vez de gerar um backup vazio).

## Configuração (uma vez)

### 1. Bucket e chave no R2

O bucket `gestao-validades-backups` já existe. No painel da Cloudflare, em
**R2 → Manage API tokens → Create API token**, crie uma chave com permissão
**Object Read & Write** **restrita a esse bucket** (não ao bucket dos anexos).
Guarde o *Access Key ID* e o *Secret Access Key* — o segredo só aparece uma vez.

### 2. Login de leitura no Neon

No editor SQL do Neon (banco de produção), como dono:

```sql
create role backup_leitor login bypassrls password 'UMA-SENHA-LONGA-E-ALEATORIA';
grant pg_read_all_data to backup_leitor;
```

A string de conexão é a **direta**, sem `-pooler` no endereço (o pooler do Neon
atrapalha o `pg_dump`):

```
postgresql://backup_leitor:SENHA@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

### 3. Frase-senha da criptografia

Gere uma frase longa e aleatória e guarde num **gerenciador de senhas, fora do
GitHub**. Sem ela os backups são ilegíveis: se você a perder junto com o acesso ao
GitHub, perde também as cópias.

### 4. Segredos no GitHub

Repositório → **Settings → Secrets and variables → Actions → New repository secret**:

| Segredo | Valor |
|---|---|
| `DATABASE_URL_BACKUP` | a string do `backup_leitor` (passo 2) |
| `BACKUP_PASSPHRASE` | a frase-senha (passo 3) |
| `BACKUP_R2_ACCOUNT_ID` | ID da conta Cloudflare (o mesmo de `R2_ACCOUNT_ID`) |
| `BACKUP_R2_ACCESS_KEY_ID` | chave do passo 1 |
| `BACKUP_R2_SECRET_ACCESS_KEY` | segredo do passo 1 |
| `BACKUP_R2_BUCKET` | `gestao-validades-backups` |

### 5. Primeira execução

Aba **Actions → Backup do banco → Run workflow**. No fim do log, o passo
"Testar a restauração" imprime a contagem de linhas restauradas. Confira se bate
com o que você espera (produtos, lojas, lotes).

## Recuperar

### Apaguei dados por engano

Quase sempre você não quer o banco inteiro de ontem, só o que sumiu. Então:
**não restaure por cima da produção.** Crie um banco novo (branch ou projeto no
Neon), restaure o backup ali e copie de lá o que faltou (um `insert ... select`,
ou exportar as linhas). Os dados de hoje ficam intactos.

### Perdi o banco

1. Crie um projeto novo no Neon (mesma versão do Postgres) e anote a string de
   conexão do dono.
2. Restaure (precisa de `pg_restore`, `gpg` e Node; tudo isto é na sua máquina):

   ```bash
   cd backend
   export BACKUP_PASSPHRASE='…'
   export BACKUP_R2_ACCOUNT_ID=… BACKUP_R2_ACCESS_KEY_ID=… \
          BACKUP_R2_SECRET_ACCESS_KEY=… BACKUP_R2_BUCKET=gestao-validades-backups
   node scripts/backup/r2.mjs listar diario/            # escolha a chave
   bash scripts/backup/restaurar.sh diario/gestao-AAAAMMDD-HHMMSS.dump.gpg \
        'postgresql://dono:senha@host/neondb?sslmode=require'
   ```

   O script recusa um banco que já tenha tabelas e falha em qualquer erro.
3. Defina a senha das roles de login (o dump não traz senha de role):
   `alter role app_runtime password '…'; alter role app_auth password '…';`
4. Aponte `DATABASE_URL` e `AUTH_DATABASE_URL` no Render para o banco novo.
   As migrações já vêm aplicadas (a tabela `pgmigrations` é restaurada junto).

Já tem a frase-senha e o arquivo `.gpg` baixado? `restaurar.sh` aceita o caminho
do arquivo no lugar da chave.

> **O que o `restaurar.sh` ajeita sozinho.** O dump referencia roles que não vêm
> nele (`app_runtime`, `app_auth`, `app_definer`, `neondb_owner` e as do próprio
> Neon, `cloud_admin` e `neon_superuser`); o script cria as que faltarem, dá ao
> dono do banco o direito de entregar objetos ao `app_definer` e, no fim, tira dele
> o direito de criar no schema (o mesmo caminho da migração 0003). Foi testado
> restaurando como um dono **sem** privilégio de superusuário num Postgres vazio,
> que é o que o Neon entrega, mas **não** contra um projeto novo de verdade do
> Neon: na primeira vez, confira o resultado (o script imprime a contagem) e
> teste um login antes de apontar o servidor.

## O que o backup NÃO cobre

- **Os arquivos dos anexos** (fotos e documentos de quebra) ficam no bucket
  `gestao-validades-anexos`; o backup guarda só a lista deles (tabela `anexos`).
  Arquivo apagado de lá não volta.
- **Até 24 horas de dados.** O que foi lançado depois do último backup e antes de
  um desastre se perde. Os 6 horas do histórico do Neon ainda cobrem o dia corrente.
- **Falha silenciosa.** Se o agendamento parar de rodar, ninguém é avisado de que
  *não* houve backup. O GitHub avisa por e-mail quando uma execução **falha**, mas
  em repositório público ele **desliga** agendamentos depois de 60 dias sem
  nenhuma atividade no repositório. Confira de vez em quando a aba Actions, ou
  considere um alerta externo de "não recebi sinal".

## Rodar os scripts no computador

Variáveis em `backend/scripts/backup/*.sh` (cabeçalho de cada um). Para testar sem
a Cloudflare, `BACKUP_R2_ENDPOINT` aponta para qualquer servidor S3 local.
`DRY_RUN=1 bash scripts/backup/aplicar-retencao.sh` mostra o que a retenção
apagaria, sem apagar.
