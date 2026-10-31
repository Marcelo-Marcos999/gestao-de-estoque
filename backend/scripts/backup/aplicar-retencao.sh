#!/usr/bin/env bash
# Apaga do R2 os backups velhos, para o bucket não crescer sem limite.
#
# Fica: os 7 mais recentes (qualquer idade), tudo dos últimos 30 dias e o
# primeiro de cada mês por 12 meses. Dá recuo de um mês para pegar um erro
# descoberto tarde, e um ponto por mês para um problema antigo.
#
# Só roda depois de um backup novo ter sido enviado E restaurado com sucesso
# (ver o workflow): apagar histórico com base num backup que falhou deixaria
# menos cópias do que antes.
#
# DRY_RUN=1 só mostra o que apagaria.
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
source "$aqui/comum.sh"

MANTER_RECENTES=7
MANTER_DIAS=30
MANTER_MENSAIS_DIAS=365

mapfile -t chaves < <(node "$aqui/r2.mjs" listar diario/ | grep -E '^diario/gestao-[0-9]{8}-[0-9]{6}\.dump\.gpg$' | sort)
total=${#chaves[@]}

# Lista vazia ou curta demais para ter o que podar: não faz nada, em vez de
# arriscar apagar por causa de uma listagem que veio errada.
if ((total <= MANTER_RECENTES)); then
  echo "Só $total backup(s); nada a apagar."
  exit 0
fi

agora="$(date -u +%s)"
apagados=0
for i in "${!chaves[@]}"; do
  chave="${chaves[$i]}"
  data="${chave:14:8}"
  idade=$(((agora - $(date -u -d "$data" +%s)) / 86400))
  dia="${data:6:2}"

  ((i >= total - MANTER_RECENTES)) && continue
  ((idade <= MANTER_DIAS)) && continue
  [[ "$dia" == "01" ]] && ((idade <= MANTER_MENSAIS_DIAS)) && continue

  if [[ "${DRY_RUN:-}" == "1" ]]; then
    echo "apagaria $chave (${idade} dias)"
  else
    node "$aqui/r2.mjs" apagar "$chave"
  fi
  apagados=$((apagados + 1))
done
echo "Retenção: $apagados apagado(s) de $total."
