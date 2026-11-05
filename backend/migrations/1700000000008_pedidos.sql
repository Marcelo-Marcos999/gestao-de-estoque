-- Up Migration

-- Pedidos (PD) de clientes: o vendedor monta o pedido item a item, consultando o
-- preço de venda e o saldo da loja, aplica desconto e fecha com o total que o
-- cliente vai pagar. Um pedido fechado pode ser reaberto para corrigir os itens.
--
-- O pedido NÃO baixa o estoque: o saldo vem da importação do ERP, e abater aqui
-- criaria um segundo saldo que ninguém reconcilia (mesma razão da Quebra, ver
-- docs/dominio.md).

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  -- A loja que vende. Como em `contagens`, é ela que isola um pedido do outro:
  -- login = loja.
  loja_id uuid not null references lojas(id) on delete cascade,
  -- "PD 12": o número que o vendedor fala ao telefone. Sequencial POR LOJA e
  -- preenchido pelo gatilho abaixo; um serial global vazaria quantos pedidos as
  -- outras empresas fizeram.
  numero integer not null check (numero > 0),
  cliente text not null check (length(btrim(cliente)) between 1 and 120),
  observacao text not null default '' check (length(observacao) <= 500),
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  -- Quem montou pode ser diferente de loja_id (o administrador pela loja de
  -- outro), como em `quebras`.
  criado_por_id uuid not null references lojas(id) on delete restrict,
  criado_em timestamptz not null default now(),
  fechado_em timestamptz,
  -- Fechado e "tem data de fechamento" são a mesma informação: impedir que
  -- divirjam poupa a tela de decidir em qual acreditar.
  check ((status = 'fechado') = (fechado_em is not null)),
  unique (loja_id, numero)
);

create index pedidos_loja_criado on pedidos (loja_id, criado_em desc);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  -- `set null` e não `cascade`: o pedido é um registro comercial. Se o
  -- administrador apagar o produto do cadastro, o pedido fechado continua
  -- dizendo o que foi vendido (por isso sku e descrição são copiados abaixo).
  produto_id uuid references produtos(id) on delete set null,
  sku text not null,
  descricao text not null,
  codigo_barras text not null default '',
  quantidade integer not null check (quantidade between 1 and 1000000),
  -- Preço e custo são COPIADOS do estoque da loja no momento em que o item entra.
  -- Se fossem lidos do estoque na hora de mostrar, uma nova importação do ERP
  -- mudaria o total de um pedido já combinado com o cliente.
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  custo_unitario numeric(12,2) not null check (custo_unitario >= 0),
  -- 'percentual': % sobre a linha. 'valor': reais abatidos da linha inteira
  -- (quantidade × preço), não de cada unidade.
  desconto_tipo text not null default 'valor' check (desconto_tipo in ('percentual', 'valor')),
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  criado_em timestamptz not null default now(),
  -- Um desconto que deixasse a linha negativa não é desconto, é erro de digitação.
  check (desconto_tipo <> 'percentual' or desconto <= 100),
  check (desconto_tipo <> 'valor' or desconto <= quantidade * preco_unitario)
);

create index pedido_itens_pedido on pedido_itens (pedido_id, criado_em);

-- Numeração por loja. A trava serializa dois pedidos nascendo juntos na mesma
-- loja: sem ela os dois leriam o mesmo maior número e um deles bateria na
-- chave única. Pedidos apagados deixam buracos na sequência, de propósito: reusar
-- um número faria "PD 12" apontar para dois pedidos diferentes ao longo do tempo.
create function pedidos_numerar() returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('pedido:' || new.loja_id::text));
  select coalesce(max(numero), 0) + 1 into new.numero from pedidos where loja_id = new.loja_id;
  return new;
end
$$;

create trigger pedidos_numerar before insert on pedidos
  for each row execute function pedidos_numerar();

grant select, insert, update, delete on pedidos, pedido_itens to app_runtime;

-- Mesma regra do estoque e da auditoria: o operador só enxerga a própria loja; o
-- administrador, a conta inteira; ninguém enxerga outra conta.
alter table pedidos enable row level security;
alter table pedidos force row level security;

create policy pedidos_all on pedidos for all
  using (
    exists (
      select 1 from lojas l
      where l.id = pedidos.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  )
  with check (
    exists (
      select 1 from lojas l
      where l.id = pedidos.loja_id
        and l.conta_id = app_conta_id()
        and (app_role() = 'admin' or l.id = app_loja_id())
    )
  );

-- O item herda o acesso do pedido: a subconsulta já passa pela política acima.
alter table pedido_itens enable row level security;
alter table pedido_itens force row level security;

create policy pedido_itens_all on pedido_itens for all
  using (exists (select 1 from pedidos p where p.id = pedido_itens.pedido_id))
  with check (exists (select 1 from pedidos p where p.id = pedido_itens.pedido_id));

-- ---------------------------------------------------------------------------
-- Entra no limite de registros do plano (ver a migração 0006)
-- ---------------------------------------------------------------------------

grant select on pedidos, pedido_itens to app_definer;
create policy definer_pedidos_leitura on pedidos for select to app_definer using (true);
create policy definer_pedido_itens_leitura on pedido_itens for select to app_definer using (true);

-- Mesma função da 0007, com as duas tabelas novas somadas. `create or replace`
-- preserva o dono (`app_definer`).
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
    + (select count(*) from contagens c join lojas l on l.id = c.loja_id where l.conta_id = p_conta)
    + (select count(*) from pedidos pd join lojas l on l.id = pd.loja_id where l.conta_id = p_conta)
    + (select count(*) from pedido_itens pi
         join pedidos pd on pd.id = pi.pedido_id
         join lojas l on l.id = pd.loja_id where l.conta_id = p_conta),
    (select coalesce(sum(a.tamanho_bytes), 0)::bigint from anexos a
       join quebras q on q.id = a.quebra_id
       join lojas l on l.id = q.loja_id where l.conta_id = p_conta)
$$;

create trigger limite_registros_pedidos after insert on pedidos
  referencing new table as novas for each statement execute function conferir_limite_de_registros();
create trigger limite_registros_pedido_itens after insert on pedido_itens
  referencing new table as novas for each statement execute function conferir_limite_de_registros();

-- Down Migration

drop trigger if exists limite_registros_pedido_itens on pedido_itens;
drop trigger if exists limite_registros_pedidos on pedidos;

-- Volta a função à versão da migração 0007 (sem os pedidos).
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

drop policy if exists definer_pedido_itens_leitura on pedido_itens;
drop policy if exists definer_pedidos_leitura on pedidos;
drop trigger if exists pedidos_numerar on pedidos;
drop function if exists pedidos_numerar();
drop table if exists pedido_itens;
drop table if exists pedidos;
