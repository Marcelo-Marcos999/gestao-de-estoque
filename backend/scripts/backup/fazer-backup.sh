#!/usr/bin/env bash
# Faz o backup: dump do banco → conferência → criptografia → envio ao R2.
#
# Variáveis: DATABASE_URL_BACKUP, BACKUP_PASSPHRASE e as BACKUP_R2_* (ver
# docs/backup.md). Escreve a chave do objeto enviado em $BACKUP_DIR/ultima-chave
# (e em $GITHUB_OUTPUT, quando rodando no GitHub Actions).
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
source "$aqui/comum.sh"

exigir_variaveis DATABASE_URL_BACKUP BACKUP_PASSPHRASE
dir="${BACKUP_DIR:-$(mktemp -d)}"
mkdir -p "$dir"
bruto="$dir/gestao.dump"
cifrado="$dir/gestao.dump.gpg"
# O dump sem criptografia tem hash de senha e e-mail de todo mundo: some assim
# que o script termina, dê certo ou não.
trap 'rm -f "$bruto"' EXIT

# Formato "custom": já sai comprimido e deixa o pg_restore restaurar por partes.
# SEM --no-owner de propósito: o dono das funções SECURITY DEFINER precisa
# sobreviver à restauração (ver comum.sh).
echo "Gerando o dump…"
pg_dump --format=custom --dbname="$DATABASE_URL_BACKUP" --file="$bruto"

echo "Conferindo o conteúdo…"
tamanho="$(stat -c %s "$bruto")"
if ((tamanho < 10000)); then
  echo "Dump suspeito: só $tamanho bytes." >&2
  exit 1
fi
lista="$(pg_restore --list "$bruto")"
for tabela in "${TABELAS_OBRIGATORIAS[@]}"; do
  if ! grep -Eq "TABLE DATA public $tabela( |$)" <<<"$lista"; then
    echo "O dump não tem os dados da tabela '$tabela'." >&2
    exit 1
  fi
done

echo "Criptografando…"
# AES-256 com integridade (o gpg acusa se o arquivo foi alterado). Sem
# compressão: o formato custom já é comprimido.
gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
  --compress-algo none --passphrase-fd 3 --output "$cifrado" "$bruto" 3<<<"$BACKUP_PASSPHRASE"

chave="diario/gestao-$(date -u +%Y%m%d-%H%M%S).dump.gpg"
node "$aqui/r2.mjs" enviar "$cifrado" "$chave"

echo "$chave" >"$dir/ultima-chave"
[[ -z "${GITHUB_OUTPUT:-}" ]] || echo "chave=$chave" >>"$GITHUB_OUTPUT"
echo "Backup concluído: $chave"
