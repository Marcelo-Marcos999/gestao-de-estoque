#!/usr/bin/env bash
# Restaura um backup num banco NOVO e VAZIO (recuperação de desastre).
#
# Uso: restaurar.sh <chave-no-r2 | arquivo.dump.gpg> <url-do-banco-destino>
# Variáveis: BACKUP_PASSPHRASE e, se for baixar do R2, as BACKUP_R2_*.
#
# Recusa um destino que já tenha tabelas: restaurar por cima de dados vivos
# misturaria as duas versões. Para voltar o estado de ontem, crie um banco
# novo (um projeto ou branch no Neon), restaure ali e aponte o DATABASE_URL do
# servidor para ele. Passo a passo em docs/backup.md.
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
source "$aqui/comum.sh"

origem="${1:?Informe a chave do R2 ou o caminho do arquivo .gpg}"
destino="${2:?Informe a URL do banco de destino}"
exigir_variaveis BACKUP_PASSPHRASE
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT

# Tabelas E tipos: uma tentativa anterior que falhou pode ter deixado só os tipos.
existentes="$(psql "$destino" -v ON_ERROR_STOP=1 -qAt -c "
  select (select count(*) from pg_tables where schemaname = 'public')
       + (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' and t.typtype = 'e')")"
if [[ "$existentes" != "0" ]]; then
  echo "O banco de destino já tem objetos ($existentes). Use um banco vazio." >&2
  exit 1
fi

if [[ -f "$origem" ]]; then
  cp "$origem" "$dir/gestao.dump.gpg"
else
  node "$aqui/r2.mjs" baixar "$origem" "$dir/gestao.dump.gpg"
fi
decifrar "$dir/gestao.dump.gpg" "$dir/gestao.dump"

restaurar_dump "$dir/gestao.dump" "$destino"

echo "Restaurado. Conteúdo:"
resumo_banco "$destino" | sed 's/^/  /'
cat <<'FIM'

Faltam dois passos manuais:
  1. Definir a senha das roles de login (o dump não traz senhas de role):
       alter role app_runtime password '...';
       alter role app_auth password '...';
  2. Apontar DATABASE_URL e AUTH_DATABASE_URL do servidor para este banco.
FIM
