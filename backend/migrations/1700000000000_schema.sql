-- Up Migration

-- Gestão de Estoque — schema do banco (Postgres puro, Neon)
--
-- Arquivo pensado pra duas coisas: (1) rodar como primeira migration no Neon,
-- (2) ser importado no Visual Paradigm via engenharia reversa de SQL, pra
-- gerar o ERD automaticamente. Por isso não tem RLS nem seed aqui — só
-- estrutura, que é o que a ferramenta de diagrama entende.

create extension if not exists pg_trgm;

create type loja_role as enum ('admin', 'operador');
create type anexo_tipo as enum ('foto-produto', 'foto-etiqueta', 'documento');

-- Função genérica pra manter atualizado_em sem depender de toda query
-- lembrar de setar isso na mão.
create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Camada de conta
-- ---------------------------------------------------------------------------

create table contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- Time interno (compras/normalização), nunca atrás da mesma API do cliente.
create table administradores_plataforma (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- O login é a loja: email/senha moram aqui. loja_id null em usuarios
-- normais não existe mais — quem é admin tem role = 'admin' e enxerga a
-- conta inteira (regra aplicada no backend/RLS, não aqui).
--
-- email é único no sistema inteiro, não por conta: no login a pessoa só
-- digita email+senha, sem dizer de qual empresa é. Se o mesmo email
-- existisse em duas contas, o backend não saberia qual delas autenticar.
create table lojas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas(id) on delete cascade,
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  role loja_role not null default 'operador',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);

create trigger lojas_atualizado_em
  before update on lojas
  for each row execute function set_atualizado_em();

create table configuracoes_conta (
  conta_id uuid primary key references contas(id) on delete cascade,
  limite_usuarios integer,
  limite_armazenamento_mb integer,
  plano text not null default 'padrao',
  atualizado_em timestamptz
);

create trigger configuracoes_conta_atualizado_em
  before update on configuracoes_conta
  for each row execute function set_atualizado_em();

-- Público, sem conta_id — o changelog é o mesmo pra todo cliente.
create table changelog (
  id uuid primary key default gen_random_uuid(),
  versao text not null,
  titulo text not null,
  descricao text,
  -- Entrada restrita mostra texto_generico pra quem não é admin, nunca o
  -- título/descrição de verdade.
  restrito_admin boolean not null default false,
  texto_generico text,
  publicado_em timestamptz not null default now(),
  check (not restrito_admin or texto_generico is not null)
);

-- ---------------------------------------------------------------------------
-- Catálogo (compartilhado por toda a conta, não por loja)
-- ---------------------------------------------------------------------------

create table produtos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas(id) on delete cascade,
  sku text not null,
  descricao text not null default '',
  codigo_barras text,
  -- Criado sem cadastro completo (import de estoque com SKU desconhecido).
  pendente_cadastro boolean not null default false,
  -- Só preenchido enquanto pendente: de qual loja veio o pedido de cadastro.
  loja_origem_id uuid references lojas(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  unique (conta_id, sku)
);

create trigger produtos_atualizado_em
  before update on produtos
  for each row execute function set_atualizado_em();

-- Busca por descrição não usa índice comum (ILIKE '%termo%'); trigram
-- resolve sem precisar de full-text search por enquanto.
create index produtos_descricao_trgm on produtos using gin (descricao gin_trgm_ops);

-- Fila do ADM: pequena e sempre filtrada por essa condição — parcial fica
-- muito mais leve que indexar a tabela toda.
create index produtos_pendentes on produtos (conta_id) where pendente_cadastro = true;

create unique index produtos_codigo_barras_unico
  on produtos (conta_id, codigo_barras)
  where codigo_barras is not null and codigo_barras <> '';

-- ---------------------------------------------------------------------------
-- Operacional (por loja)
-- ---------------------------------------------------------------------------

create table estoque (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  -- Não deixa excluir produto do catálogo enquanto alguma loja tem estoque dele.
  produto_id uuid not null references produtos(id) on delete restrict,
  saldo integer not null default 0 check (saldo >= 0),
  saidas integer not null default 0 check (saidas >= 0),
  valor_custo numeric(12,2) not null default 0 check (valor_custo >= 0),
  valor_venda numeric(12,2) not null default 0 check (valor_venda >= 0),
  atualizado_em timestamptz,
  unique (loja_id, produto_id)
);

create trigger estoque_atualizado_em
  before update on estoque
  for each row execute function set_atualizado_em();

create table validades (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references estoque(id) on delete cascade,
  data_validade date,
  criado_em timestamptz not null default now()
);

-- Tela de Validades ordena por urgência o tempo todo.
create index validades_estoque_data on validades (estoque_id, data_validade);

create table motivos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas(id) on delete cascade,
  label text not null,
  embutido boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (conta_id, label)
);

create table origens (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas(id) on delete cascade,
  label text not null,
  embutido boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (conta_id, label)
);

create table quebras (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete restrict,
  -- Nulo só enquanto o produto não existe no catálogo (fluxo de pendência).
  produto_id uuid references produtos(id) on delete set null,
  sku text,
  descricao text,
  codigo_barras text,
  pendente_produto boolean not null default false,
  data_validade date,
  quantidade integer not null check (quantidade >= 0),
  -- Motivo e origem obrigatórios: exatamente um de cada.
  motivo_id uuid not null references motivos(id) on delete restrict,
  origem_id uuid not null references origens(id) on delete restrict,
  -- Fica nulo sozinho quando o lote de origem é excluído depois.
  origem_lote_id uuid references validades(id) on delete set null,
  observacao text,
  -- Quem registrou pode ser diferente de loja_id (ADM agindo por outra loja).
  criado_por_id uuid not null references lojas(id) on delete restrict,
  criado_em timestamptz not null default now()
);

-- Listagem padrão da tela de Quebra.
create index quebras_loja_recentes on quebras (loja_id, criado_em desc);
create index quebras_produto on quebras (produto_id);
create index quebras_motivo on quebras (motivo_id);
create index quebras_origem on quebras (origem_id);
create index quebras_criado_por on quebras (criado_por_id);

create table anexos (
  id uuid primary key default gen_random_uuid(),
  quebra_id uuid not null references quebras(id) on delete cascade,
  tipo anexo_tipo not null,
  nome_arquivo text not null,
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes >= 0),
  storage_path text not null,
  criado_em timestamptz not null default now()
);

create index anexos_quebra on anexos (quebra_id);

-- Down Migration

drop table if exists anexos cascade;
drop table if exists quebras cascade;
drop table if exists origens cascade;
drop table if exists motivos cascade;
drop table if exists validades cascade;
drop table if exists estoque cascade;
drop table if exists produtos cascade;
drop table if exists changelog cascade;
drop table if exists configuracoes_conta cascade;
drop table if exists lojas cascade;
drop table if exists administradores_plataforma cascade;
drop table if exists contas cascade;
drop function if exists set_atualizado_em();
drop type if exists anexo_tipo;
drop type if exists loja_role;
