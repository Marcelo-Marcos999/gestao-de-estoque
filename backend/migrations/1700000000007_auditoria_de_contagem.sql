-- Up Migration

-- Auditoria de estoque: a contagem física de cada produto, por loja.
--
-- Cada registro é uma LINHA nova (só se acrescenta, nunca se soma por cima), e a
-- contagem de um produto é a soma das linhas dele naquela loja. É o que faz duas
-- pessoas contando o mesmo produto se somarem: A registra 10, B registra 5, e o
-- produto passa a ter 15. Gravar "contagem = contagem + 5" numa linha só perderia
-- um dos dois registros se acontecessem ao mesmo tempo; acrescentar linhas não
-- perde nada, e ainda guarda QUEM contou cada parcela e QUANDO — o que, numa
-- auditoria, é a própria prova.

create table contagens (
  id uuid primary key default gen_random_uuid(),
  -- A loja cujo estoque está sendo conferido. É o "id do usuário" que isola uma
  -- loja da outra (ver a política abaixo): login = loja, neste sistema.
  loja_id uuid not null references lojas(id) on delete cascade,
  -- Só produto do cadastro: a contagem é comparada com a posição de estoque dele.
  -- Sem o produto, a contagem não teria o que comparar, então sai junto.
  produto_id uuid not null references produtos(id) on delete cascade,
  -- Zero vale e é diferente de "não contado": é a pessoa dizendo que olhou a
  -- prateleira e não havia nada.
  quantidade integer not null check (quantidade >= 0 and quantidade <= 1000000),
  -- Quem registrou pode ser diferente de loja_id (o administrador contando por
  -- outra loja), como em `quebras`.
  criado_por_id uuid not null references lojas(id) on delete restrict,
  criado_em timestamptz not null default now()
);

-- A listagem soma por (loja, produto): este índice a atende sem varrer a tabela.
create index contagens_loja_produto on contagens (loja_id, produto_id);

grant select, insert, update, delete on contagens to app_runtime;

-- Mesma regra do estoque: o operador só enxerga a própria loja; o administrador,
-- a conta inteira; ninguém enxerga outra conta.
alter table contagens enable row level security;
alter table contagens force row level security;

create policy contagens_all on contagens for all
  using (
    exists (
      select 1 from lojas l
      where l.id = contagens.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  )
  with check (
    exists (
      select 1 from lojas l
      where l.id = contagens.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Entra no limite de registros do plano (ver a migração 0006)
-- ---------------------------------------------------------------------------

-- Sem isto a auditoria seria um caminho para passar do teto: bastaria contar.
grant select on contagens to app_definer;
create policy definer_contagens_leitura on contagens for select to app_definer using (true);

-- Mesma função, com a nova tabela somada. `create or replace` preserva o dono
-- (`app_definer`), então não repete a troca de posse da migração anterior.
create or replace function calcular_uso(p_conta uuid)
returns table (registros bigint, arquivos_bytes bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from produtos where conta_id = p_conta)
    + (select count(*) from estoque e join lojas l on l.id = e.loja_id where l.conta_id = p_conta)
    + (select count(*) from validades v
         join estoque e on e.id = v.estoque_id
         join lojas l on l.id = e.loja_id where l.conta_id = p_conta)
    + (select count(*) from quebras q join lojas l on l.id = q.loja_id where l.conta_id = p_conta)
    + (select count(*) from contagens c join lojas l on l.id = c.loja_id where l.conta_id = p_conta),
    (select coalesce(sum(a.tamanho_bytes), 0)::bigint from anexos a
       join quebras q on q.id = a.quebra_id
       join lojas l on l.id = q.loja_id where l.conta_id = p_conta)
$$;

create trigger limite_registros_contagens after insert on contagens
  referencing new table as novas for each statement execute function conferir_limite_de_registros();

-- Down Migration

drop trigger if exists limite_registros_contagens on contagens;

-- Volta a função à versão da migração 0006 (sem a tabela de contagens).
create or replace function calcular_uso(p_conta uuid)
returns table (registros bigint, arquivos_bytes bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from produtos where conta_id = p_conta)
    + (select count(*) from estoque e join lojas l on l.id = e.loja_id where l.conta_id = p_conta)
    + (select count(*) from validades v
         join estoque e on e.id = v.estoque_id
         join lojas l on l.id = e.loja_id where l.conta_id = p_conta)
    + (select count(*) from quebras q join lojas l on l.id = q.loja_id where l.conta_id = p_conta),
    (select coalesce(sum(a.tamanho_bytes), 0)::bigint from anexos a
       join quebras q on q.id = a.quebra_id
       join lojas l on l.id = q.loja_id where l.conta_id = p_conta)
$$;

drop policy if exists definer_contagens_leitura on contagens;
drop policy if exists contagens_all on contagens;
drop table if exists contagens;
