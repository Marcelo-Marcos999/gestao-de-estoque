#!/usr/bin/env bash
# Prova que o backup enviado ao R2 serve: baixa, descriptografa, restaura num
# banco descartável e compara com o banco de verdade.
#
# Um backup que nunca foi restaurado é uma esperança, não um backup. Por isso
# isto roda a cada backup, com o arquivo que acabou de ir para o R2 (e não com o
# dump local), exercitando o caminho inteiro que um desastre exigiria.
#
# Uso: testar-restauracao.sh <chave-no-r2>
# Variáveis: DATABASE_URL_BACKUP (origem), RESTORE_DATABASE_URL (banco
# descartável e VAZIO), BACKUP_PASSPHRASE e as BACKUP_R2_*.
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
source "$aqui/comum.sh"

chave="${1:?Informe a chave do backup no R2}"
exigir_variaveis DATABASE_URL_BACKUP RESTORE_DATABASE_URL BACKUP_PASSPHRASE
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT

node "$aqui/r2.mjs" baixar "$chave" "$dir/gestao.dump.gpg"
decifrar "$dir/gestao.dump.gpg" "$dir/gestao.dump"

echo "Restaurando num banco descartável…"
restaurar_dump "$dir/gestao.dump" "$RESTORE_DATABASE_URL"

echo "Comparando com o banco de origem…"
resumo_banco "$DATABASE_URL_BACKUP" >"$dir/origem.txt"
resumo_banco "$RESTORE_DATABASE_URL" >"$dir/restaurado.txt"

problemas=0
while IFS='|' read -r tipo nome esperado; do
  obtido="$(grep -F "$tipo|$nome|" "$dir/restaurado.txt" | cut -d'|' -f3 || true)"
  obtido="${obtido:-ausente}"
  if [[ "$tipo" == "estrutura" ]]; then
    # Estrutura não muda durante o backup: tem de bater exatamente.
    [[ "$obtido" == "$esperado" ]] && continue
  else
    # Linhas: tolera a diferença de gravações feitas no meio do caminho (até 1%,
    # com folga mínima de 5).
    if [[ "$obtido" != "ausente" ]]; then
      folga=$((esperado / 100 > 5 ? esperado / 100 : 5))
      diferenca=$((esperado > obtido ? esperado - obtido : obtido - esperado))
      ((diferenca <= folga)) && continue
    fi
  fi
  echo "DIVERGÊNCIA em $nome: origem=$esperado restaurado=$obtido" >&2
  problemas=$((problemas + 1))
done <"$dir/origem.txt"

if ((problemas > 0)); then
  echo "A restauração de teste NÃO bate com a origem ($problemas divergência(s))." >&2
  exit 1
fi
echo "Restauração de teste conferida:"
sed 's/^/  /' "$dir/restaurado.txt"
