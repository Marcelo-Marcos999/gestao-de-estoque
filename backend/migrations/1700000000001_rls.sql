-- Up Migration

-- Gestão de Estoque — Row Level Security
--
-- Pré-requisito: rodar depois de schema.sql, conectado como a role dona das
-- tabelas (a mesma que criou tudo). As políticas aqui passam a valer pra
-- qualquer OUTRA role — é por isso que a role de produção (app_runtime) é
-- criada separada da role dona: o dono sempre atravessa RLS, não importa
-- quantas políticas existam.

-- ---------------------------------------------------------------------------
-- Role de produção — é a ÚNICA credencial que o backend do Render usa.
-- A senha nunca entra aqui nem em lugar nenhum versionado: defina depois com
-- ALTER ROLE app_runtime WITH PASSWORD '...' rodado na mão, ou pelo painel do
-- Neon, e guarde o resultado só na variável de ambiente do Render.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select from pg_roles where rolname = 'app_runtime') then
    create role app_runtime login;
  end if;
end
$$;

grant usage on schema public to app_runtime;
grant select, insert, update, delete on all tables in schema public to app_runtime;
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_runtime;

-- ---------------------------------------------------------------------------
-- Role só de login: busca por e-mail acontece ANTES de existir sessão —
-- não dá pra exigir app.conta_id setado pra uma query que é exatamente o
-- que decide qual conta é essa. Role separada, só SELECT, só nas duas
-- tabelas de login, nunca usada pra mais nada depois que a sessão existe.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select from pg_roles where rolname = 'app_auth') then
    create role app_auth login;
  end if;
end
$$;

grant usage on schema public to app_auth;
grant select on lojas, administradores_plataforma to app_auth;

-- ---------------------------------------------------------------------------
-- Funções auxiliares: leem o que o backend setou com SET LOCAL na
-- transação. `stable` diz ao Postgres que o valor não muda durante a mesma
-- query, o que permite o otimizador reaproveitar o resultado em vez de
-- reavaliar linha a linha.
-- ---------------------------------------------------------------------------

create or replace function app_conta_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.conta_id', true), '')::uuid
$$;

create or replace function app_loja_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.loja_id', true), '')::uuid
$$;

create or replace function app_role() returns text
language sql stable as $$
  select current_setting('app.role', true)
$$;

-- ---------------------------------------------------------------------------
-- contas: cada login só vê a própria conta. Criar conta nova é fluxo de
-- assinatura — não passa pela app_runtime, fica fora daqui de propósito.
-- ---------------------------------------------------------------------------

alter table contas enable row level security;
alter table contas force row level security;

create policy contas_select on contas for select
  using (id = app_conta_id());

create policy contas_update on contas for update
  using (id = app_conta_id() and app_role() = 'admin')
  with check (id = app_conta_id() and app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- lojas: toda loja da mesma conta é visível (pra listar quem tem acesso).
-- Só admin cria/exclui login novo. Cada um edita o próprio; admin edita
-- qualquer um da conta.
-- ---------------------------------------------------------------------------

alter table lojas enable row level security;
alter table lojas force row level security;

create policy lojas_select on lojas for select
  using (conta_id = app_conta_id());

create policy lojas_insert on lojas for insert
  with check (conta_id = app_conta_id() and app_role() = 'admin');

create policy lojas_update on lojas for update
  using (conta_id = app_conta_id() and (app_role() = 'admin' or id = app_loja_id()))
  with check (conta_id = app_conta_id());

create policy lojas_delete on lojas for delete
  using (conta_id = app_conta_id() and app_role() = 'admin');

-- Só pra app_auth, só SELECT, sem checar conta_id — é a busca "quem é esse
-- e-mail" que acontece antes de qualquer sessão existir. `to app_auth`
-- restringe essa política a essa role só; app_runtime continua regido
-- pelas políticas acima, nunca por esta.
create policy lojas_login_lookup on lojas for select
  to app_auth
  using (true);

-- ---------------------------------------------------------------------------
-- configuracoes_conta: leitura liberada pra conta, escrita só pro admin.
-- ---------------------------------------------------------------------------

alter table configuracoes_conta enable row level security;
alter table configuracoes_conta force row level security;

create policy configuracoes_conta_select on configuracoes_conta for select
  using (conta_id = app_conta_id());

create policy configuracoes_conta_update on configuracoes_conta for update
  using (conta_id = app_conta_id() and app_role() = 'admin')
  with check (conta_id = app_conta_id());

-- ---------------------------------------------------------------------------
-- changelog: público pra qualquer login. A restrição de conteúdo pra quem
-- não é admin (texto_generico no lugar do real) é lógica de aplicação, não
-- de RLS — RLS decide se a LINHA aparece ou não, não troca o conteúdo de um
-- campo mantendo a linha visível. Escrita só pela role interna da
-- plataforma, fora do caminho da app_runtime.
-- ---------------------------------------------------------------------------

alter table changelog enable row level security;
alter table changelog force row level security;

create policy changelog_select on changelog for select using (true);

-- ---------------------------------------------------------------------------
-- produtos / motivos / origens: catálogo da conta inteira.
-- produtos só o admin mexe (padronização do cadastro). motivos/origens
-- qualquer login da conta mexe — já era assim no app original.
-- ---------------------------------------------------------------------------

alter table produtos enable row level security;
alter table produtos force row level security;

create policy produtos_select on produtos for select
  using (conta_id = app_conta_id());

create policy produtos_insert on produtos for insert
  with check (conta_id = app_conta_id() and app_role() = 'admin');

create policy produtos_update on produtos for update
  using (conta_id = app_conta_id() and app_role() = 'admin')
  with check (conta_id = app_conta_id());

create policy produtos_delete on produtos for delete
  using (conta_id = app_conta_id() and app_role() = 'admin');

alter table motivos enable row level security;
alter table motivos force row level security;

create policy motivos_select on motivos for select using (conta_id = app_conta_id());
create policy motivos_insert on motivos for insert with check (conta_id = app_conta_id());
create policy motivos_update on motivos for update
  using (conta_id = app_conta_id()) with check (conta_id = app_conta_id());
create policy motivos_delete on motivos for delete using (conta_id = app_conta_id());

alter table origens enable row level security;
alter table origens force row level security;

create policy origens_select on origens for select using (conta_id = app_conta_id());
create policy origens_insert on origens for insert with check (conta_id = app_conta_id());
create policy origens_update on origens for update
  using (conta_id = app_conta_id()) with check (conta_id = app_conta_id());
create policy origens_delete on origens for delete using (conta_id = app_conta_id());

-- ---------------------------------------------------------------------------
-- estoque / validades: não têm conta_id direto, então a política confere
-- por dentro de lojas. operador só vê a própria loja; admin vê a conta
-- inteira.
-- ---------------------------------------------------------------------------

alter table estoque enable row level security;
alter table estoque force row level security;

create policy estoque_all on estoque for all
  using (
    exists (
      select 1 from lojas l
      where l.id = estoque.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  )
  with check (
    exists (
      select 1 from lojas l
      where l.id = estoque.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  );

alter table validades enable row level security;
alter table validades force row level security;

create policy validades_all on validades for all
  using (
    exists (
      select 1 from estoque e
      join lojas l on l.id = e.loja_id
      where e.id = validades.estoque_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  )
  with check (
    exists (
      select 1 from estoque e
      join lojas l on l.id = e.loja_id
      where e.id = validades.estoque_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  );

-- ---------------------------------------------------------------------------
-- quebras / anexos: quebras tem loja_id direto. anexos entra por quebra_id.
-- ---------------------------------------------------------------------------

alter table quebras enable row level security;
alter table quebras force row level security;

create policy quebras_all on quebras for all
  using (
    exists (
      select 1 from lojas l
      where l.id = quebras.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  )
  with check (
    exists (
      select 1 from lojas l
      where l.id = quebras.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  );

alter table anexos enable row level security;
alter table anexos force row level security;

create policy anexos_all on anexos for all
  using (
    exists (
      select 1 from quebras q
      join lojas l on l.id = q.loja_id
      where q.id = anexos.quebra_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  )
  with check (
    exists (
      select 1 from quebras q
      join lojas l on l.id = q.loja_id
      where q.id = anexos.quebra_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  );

-- ---------------------------------------------------------------------------
-- administradores_plataforma: só a política de login está aqui. A
-- app_runtime (contas de cliente) nunca tem acesso nenhum a esta tabela —
-- nem select, porque não foi dado grant nenhum pra ela. O que falta
-- (acesso de leitura/escrita entre contas DEPOIS que o super admin loga,
-- pro trabalho de normalização do catálogo) é uma role própria ainda não
-- escrita — fica pra quando essa tela existir de verdade, pra não desenhar
-- política em cima de uma necessidade que ainda não foi usada.
-- ---------------------------------------------------------------------------

alter table administradores_plataforma enable row level security;
alter table administradores_plataforma force row level security;

create policy administradores_login_lookup on administradores_plataforma for select
  to app_auth
  using (true);

-- Down Migration

drop policy if exists administradores_login_lookup on administradores_plataforma;
alter table administradores_plataforma disable row level security;

drop policy if exists anexos_all on anexos;
drop policy if exists quebras_all on quebras;
drop policy if exists validades_all on validades;
drop policy if exists estoque_all on estoque;
drop policy if exists origens_delete on origens;
drop policy if exists origens_update on origens;
drop policy if exists origens_insert on origens;
drop policy if exists origens_select on origens;
drop policy if exists motivos_delete on motivos;
drop policy if exists motivos_update on motivos;
drop policy if exists motivos_insert on motivos;
drop policy if exists motivos_select on motivos;
drop policy if exists produtos_delete on produtos;
drop policy if exists produtos_update on produtos;
drop policy if exists produtos_insert on produtos;
drop policy if exists produtos_select on produtos;
drop policy if exists changelog_select on changelog;
drop policy if exists configuracoes_conta_update on configuracoes_conta;
drop policy if exists configuracoes_conta_select on configuracoes_conta;
drop policy if exists lojas_login_lookup on lojas;
drop policy if exists lojas_delete on lojas;
drop policy if exists lojas_update on lojas;
drop policy if exists lojas_insert on lojas;
drop policy if exists lojas_select on lojas;
drop policy if exists contas_update on contas;
drop policy if exists contas_select on contas;

alter table anexos disable row level security;
alter table quebras disable row level security;
alter table validades disable row level security;
alter table estoque disable row level security;
alter table origens disable row level security;
alter table motivos disable row level security;
alter table produtos disable row level security;
alter table changelog disable row level security;
alter table configuracoes_conta disable row level security;
alter table lojas disable row level security;
alter table contas disable row level security;

drop function if exists app_role();
drop function if exists app_loja_id();
drop function if exists app_conta_id();

drop role if exists app_auth;
drop role if exists app_runtime;
