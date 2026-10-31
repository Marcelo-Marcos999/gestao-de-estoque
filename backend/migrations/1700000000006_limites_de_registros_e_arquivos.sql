-- Up Migration

-- Limites de uso por conta: quantos REGISTROS e quantos MB de ARQUIVOS (anexos).
--
-- O limite de arquivos (`limite_armazenamento_mb`) já existia na tabela, mas
-- nada o aplicava. Aqui ele passa a valer, e ganha o irmão para registros.
--
-- A regra mora no BANCO (gatilhos), não nas rotas, pelo mesmo motivo do RLS:
-- uma rota nova, uma importação ou um "desfazer" que esquecesse de conferir o
-- limite o furaria em silêncio. Com gatilho, todo caminho que insere passa por
-- ele, inclusive os que ainda não existem.

-- Nulo = sem limite, como nos outros limites da tabela.
alter table configuracoes_conta
  add column limite_registros integer check (limite_registros is null or limite_registros >= 0);

-- Padrão das contas NOVAS. As que já existem ficam como estão (nulo, sem
-- limite): impor um teto a quem já usa o sistema é decisão de quem administra a
-- plataforma, conta a conta, e não efeito colateral de uma migração.
alter table configuracoes_conta alter column limite_registros set default 250000;
alter table configuracoes_conta alter column limite_armazenamento_mb set default 1024;

-- ---------------------------------------------------------------------------
-- Quem lê o uso da conta inteira
-- ---------------------------------------------------------------------------

-- O limite é da CONTA, mas o RLS mostra ao operador só a loja dele: contando
-- como ele, o consumo das outras lojas ficaria invisível e o limite nunca
-- fecharia. As funções abaixo rodam como `app_definer`, que enxerga a conta
-- toda, e só devolvem números — nenhuma linha.
grant select on produtos, estoque, validades, quebras, anexos to app_definer;

create policy definer_produtos_leitura on produtos for select to app_definer using (true);
create policy definer_estoque_leitura on estoque for select to app_definer using (true);
create policy definer_validades_leitura on validades for select to app_definer using (true);
create policy definer_quebras_leitura on quebras for select to app_definer using (true);
create policy definer_anexos_leitura on anexos for select to app_definer using (true);

-- Registros = o que a pessoa cadastra e que cresce: produtos, linhas de
-- estoque, lotes de validade e registros de quebra. Arquivos = soma dos anexos.
--
-- Recebe a conta como argumento, então NÃO é exposta: só as funções abaixo a
-- chamam, sempre com a conta da sessão. Fosse chamável, qualquer login
-- perguntaria o consumo de uma conta alheia.
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

-- O que a tela de Configurações lê: o uso da conta DA SESSÃO, sem argumento.
create or replace function uso_da_conta()
returns table (registros bigint, arquivos_bytes bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from calcular_uso(app_conta_id())
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

-- Um gatilho por COMANDO (não por linha): uma importação de 500 linhas confere
-- uma vez, não 500. A conferência é DEPOIS de inserir, com o uso já somado: assim
-- vale o que de fato entrou — um `on conflict` que não inseriu nada não conta, e
-- uma planilha que só atualiza linhas existentes nunca esbarra no limite.
--
-- Recusa quando o comando inseriu algo E o total passou do limite. Excluir e
-- editar nunca são recusados: quem está acima do teto precisa poder limpar.
create or replace function conferir_limite_de_registros()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta uuid := app_conta_id();
  v_limite integer;
  v_uso bigint;
begin
  -- Sem sessão de usuário (migração, restauração de backup) não há conta, e
  -- portanto não há limite a aplicar.
  if v_conta is null then return null; end if;
  if not exists (select 1 from novas) then return null; end if;

  select limite_registros into v_limite from configuracoes_conta where conta_id = v_conta;
  if v_limite is null then return null; end if;

  -- Sem a trava, dois comandos simultâneos contariam sem enxergar um ao outro e
  -- passariam juntos do limite. A trava segura até o fim da transação; quem
  -- espera conta de novo já vendo o que o outro gravou.
  perform pg_advisory_xact_lock(hashtext('limites:' || v_conta::text));

  select registros into v_uso from calcular_uso(v_conta);
  if v_uso > v_limite then
    raise exception 'limite_registros'
      using errcode = '53400', detail = format('limite=%s uso=%s', v_limite, v_uso);
  end if;
  return null;
end
$$;

create or replace function conferir_limite_de_arquivos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta uuid := app_conta_id();
  v_limite_mb integer;
  v_uso bigint;
begin
  if v_conta is null then return null; end if;
  if not exists (select 1 from novas) then return null; end if;

  select limite_armazenamento_mb into v_limite_mb from configuracoes_conta where conta_id = v_conta;
  if v_limite_mb is null then return null; end if;

  perform pg_advisory_xact_lock(hashtext('limites:' || v_conta::text));

  select arquivos_bytes into v_uso from calcular_uso(v_conta);
  if v_uso > v_limite_mb::bigint * 1024 * 1024 then
    raise exception 'limite_armazenamento'
      using errcode = '53400', detail = format('limite_mb=%s uso_bytes=%s', v_limite_mb, v_uso);
  end if;
  return null;
end
$$;

create trigger limite_registros_produtos after insert on produtos
  referencing new table as novas for each statement execute function conferir_limite_de_registros();
create trigger limite_registros_estoque after insert on estoque
  referencing new table as novas for each statement execute function conferir_limite_de_registros();
create trigger limite_registros_validades after insert on validades
  referencing new table as novas for each statement execute function conferir_limite_de_registros();
create trigger limite_registros_quebras after insert on quebras
  referencing new table as novas for each statement execute function conferir_limite_de_registros();
create trigger limite_arquivos_anexos after insert on anexos
  referencing new table as novas for each statement execute function conferir_limite_de_arquivos();

-- ---------------------------------------------------------------------------
-- Dono das funções e quem pode chamar
-- ---------------------------------------------------------------------------

-- Mesma troca de dono da migração 0003: o Postgres só entrega a posse a uma
-- role que possa CRIAR no schema, e essa permissão sai logo depois.
grant create on schema public to app_definer;
alter function calcular_uso(uuid) owner to app_definer;
alter function uso_da_conta() owner to app_definer;
alter function conferir_limite_de_registros() owner to app_definer;
alter function conferir_limite_de_arquivos() owner to app_definer;
revoke create on schema public from app_definer;

revoke all on function calcular_uso(uuid) from public;
revoke all on function uso_da_conta() from public;
revoke all on function conferir_limite_de_registros() from public;
revoke all on function conferir_limite_de_arquivos() from public;

-- Só `uso_da_conta` é chamada de fora; as demais a gente chama por dentro.
grant execute on function uso_da_conta() to app_runtime;

-- Down Migration

drop trigger if exists limite_arquivos_anexos on anexos;
drop trigger if exists limite_registros_quebras on quebras;
drop trigger if exists limite_registros_validades on validades;
drop trigger if exists limite_registros_estoque on estoque;
drop trigger if exists limite_registros_produtos on produtos;

drop function if exists conferir_limite_de_arquivos();
drop function if exists conferir_limite_de_registros();
drop function if exists uso_da_conta();
drop function if exists calcular_uso(uuid);

drop policy if exists definer_anexos_leitura on anexos;
drop policy if exists definer_quebras_leitura on quebras;
drop policy if exists definer_validades_leitura on validades;
drop policy if exists definer_estoque_leitura on estoque;
drop policy if exists definer_produtos_leitura on produtos;

revoke select on produtos, estoque, validades, quebras, anexos from app_definer;

alter table configuracoes_conta alter column limite_armazenamento_mb drop default;
alter table configuracoes_conta drop column if exists limite_registros;
