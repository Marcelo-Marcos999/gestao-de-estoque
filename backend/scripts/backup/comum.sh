#!/usr/bin/env bash
# Funções usadas pelos scripts de backup. Não é para executar direto: os outros
# scripts fazem `source` deste arquivo.

# Tabelas sem as quais um backup não serve. O dump é recusado se alguma faltar:
# um arquivo "válido" que não tem os lotes é pior do que nenhum, porque dá a
# falsa segurança de que existe cópia.
TABELAS_OBRIGATORIAS=(contas lojas produtos estoque validades quebras anexos)

# Roles que o dump referencia (donos e permissões) e que não vêm dentro dele:
# roles pertencem ao servidor, não ao banco. Sem elas o pg_restore falharia — ou
# pior, restauraria sem o dono certo. `app_definer` é o caso crítico: ele é o
# dono das funções SECURITY DEFINER (criar conta, redefinir senha), e é por isso
# que elas passam pelo RLS como ele e não como o administrador do banco.
ROLES_COM_LOGIN=(app_runtime app_auth)
# `cloud_admin` e `neon_superuser` são do próprio Neon: o banco de produção tem
# permissões padrão (ALTER DEFAULT PRIVILEGES) em nome delas, e o dump as leva.
# No Neon elas já existem; num Postgres comum, como o do teste, é preciso criá-las.
ROLES_SEM_LOGIN=(app_definer neondb_owner cloud_admin neon_superuser)

exigir_variaveis() {
  local faltando=()
  for nome in "$@"; do
    [[ -n "${!nome:-}" ]] || faltando+=("$nome")
  done
  if ((${#faltando[@]} > 0)); then
    # Só os nomes: o valor de um segredo nunca vai para o log.
    echo "Faltam variáveis de ambiente: ${faltando[*]}" >&2
    exit 2
  fi
}

# Descriptografa com a frase-senha vinda do ambiente (nunca como argumento, que
# apareceria na lista de processos).
decifrar() {
  local entrada="$1" saida="$2"
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
    --output "$saida" --decrypt "$entrada" 3<<<"$BACKUP_PASSPHRASE"
}

criar_roles() {
  local destino="$1" role
  for role in "${ROLES_COM_LOGIN[@]}"; do
    psql "$destino" -v ON_ERROR_STOP=1 -qAt -c \
      "do \$\$ begin if not exists (select from pg_roles where rolname = '$role') then create role $role login; end if; end \$\$" >/dev/null
  done
  for role in "${ROLES_SEM_LOGIN[@]}"; do
    psql "$destino" -v ON_ERROR_STOP=1 -qAt -c \
      "do \$\$ begin if not exists (select from pg_roles where rolname = '$role') then create role $role nologin; end if; end \$\$" >/dev/null
  done
  # Quem restaura precisa poder "virar" cada role para entregar a ela os objetos
  # que eram dela (ALTER ... OWNER TO). Superusuário já pode; o dono do banco no
  # Neon NÃO é superusuário e sem isto a restauração para em "must be able to SET
  # ROLE app_definer". Se a concessão for recusada (role de outro dono), segue: o
  # pg_restore dirá, com a mensagem certa, se de fato faltou.
  for role in "${ROLES_COM_LOGIN[@]}" "${ROLES_SEM_LOGIN[@]}"; do
    psql "$destino" -qAt -c "grant $role to current_user" >/dev/null 2>&1 || true
  done
}

# Restaura o dump no destino. Qualquer erro reprova: o pg_restore, por padrão,
# "ignora e segue" e termina com sucesso aparente, o que numa restauração de
# desastre quer dizer um banco pela metade e ninguém sabendo.
restaurar_dump() {
  local dump="$1" destino="$2" erros
  erros="$(mktemp)"
  criar_roles "$destino"
  # Passar uma função para o app_definer exige que ele possa CRIAR no schema, e
  # o dump só restaura as permissões do schema no fim. A migração 0003 faz a
  # mesma dança (concede, entrega as funções, revoga): quem restaura sem ser
  # superusuário, como o dono do banco no Neon, precisa repeti-la.
  psql "$destino" -v ON_ERROR_STOP=1 -qAt -c "grant create on schema public to app_definer" >/dev/null
  if ! pg_restore --dbname="$destino" --exit-on-error "$dump" 2>"$erros"; then
    echo "A restauração falhou:" >&2
    head -n 20 "$erros" >&2
    # O pg_restore não desfaz o que já criou: o destino ficou pela metade.
    echo "O banco de destino ficou parcialmente restaurado: apague-o e crie outro vazio antes de tentar de novo." >&2
    rm -f "$erros"
    return 1
  fi
  rm -f "$erros"
  # app_definer não pode (nem deve) criar objetos: volta ao estado da migração.
  psql "$destino" -v ON_ERROR_STOP=1 -qAt -c "revoke create on schema public from app_definer" >/dev/null
}

# Retrato do banco para comparar origem e restauração. Linhas "tipo|nome|valor".
# Estrutura (políticas, índices, funções do definer) deve bater exatamente; as
# linhas das tabelas podem diferir um pouco, porque o banco de origem continua
# recebendo gravações enquanto o backup é conferido.
resumo_banco() {
  local url="$1" tabela
  psql "$url" -v ON_ERROR_STOP=1 -qAt -F'|' -c "
    select 'estrutura', 'politicas', count(*) from pg_policies where schemaname = 'public'
    union all select 'estrutura', 'indices', count(*) from pg_indexes where schemaname = 'public'
    union all select 'estrutura', 'tabelas_com_rls_forcado', count(*) from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity
    union all select 'estrutura', 'funcoes_do_definer', count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and pg_get_userbyid(p.proowner) = 'app_definer'
    order by 2"
  for tabela in $(psql "$url" -qAt -c "select tablename from pg_tables where schemaname = 'public' order by 1"); do
    echo "linhas|$tabela|$(psql "$url" -v ON_ERROR_STOP=1 -qAt -c "select count(*) from public.\"$tabela\"")"
  done
}
