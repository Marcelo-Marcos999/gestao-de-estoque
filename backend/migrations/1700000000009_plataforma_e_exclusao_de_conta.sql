-- Up Migration

-- Painel da plataforma (o dono do sistema) e exclusão de conta por completo.
--
-- Duas coisas pedem poder de ver ou apagar ALÉM de uma conta: o painel
-- /plataforma lista todas as empresas e ajusta os limites de cada uma, e a
-- exclusão apaga uma empresa inteira (a pedido do cliente ou do dono do
-- sistema). Nenhuma das duas cabe nas políticas de RLS, que existem justamente
-- pra isolar uma conta da outra. Por isso entram como FUNÇÕES com privilégio
-- (`security definer`), do mesmo jeito do cadastro e do cálculo de uso: o poder
-- fica num lugar pequeno, nomeado e auditável, e não numa role que enxerga tudo.

-- ---------------------------------------------------------------------------
-- O que `app_definer` precisa a mais
-- ---------------------------------------------------------------------------

-- Apagar a conta inteira. As tabelas filhas (lojas, produtos, motivos...) saem
-- em cascata, mas as que têm `on delete restrict` precisam ser esvaziadas antes,
-- na ordem certa (ver `excluir_conta`), e isso é um `delete` de verdade.
grant delete on contas, configuracoes_conta to app_definer;
grant select, delete on estoque, quebras, contagens, pedidos, produtos to app_definer;
grant update (limite_usuarios, limite_armazenamento_mb, limite_registros) on configuracoes_conta to app_definer;

create policy definer_estoque_exclusao on estoque for delete to app_definer using (true);
create policy definer_quebras_exclusao on quebras for delete to app_definer using (true);
create policy definer_contagens_exclusao on contagens for delete to app_definer using (true);
create policy definer_pedidos_exclusao on pedidos for delete to app_definer using (true);
create policy definer_produtos_exclusao on produtos for delete to app_definer using (true);

-- A leitura de produtos/pedidos/estoque/quebras/contagens já existia (0006-0008);
-- `select` acima só repete o que faltar, sem efeito onde já havia.

-- ---------------------------------------------------------------------------
-- Painel: listar as empresas
-- ---------------------------------------------------------------------------

create function plataforma_listar_contas()
returns table (
  id uuid,
  nome text,
  criado_em timestamptz,
  email_admin text,
  plano text,
  limite_usuarios integer,
  limite_armazenamento_mb integer,
  limite_registros integer,
  usuarios_ativos integer,
  usuarios_total integer,
  registros bigint,
  arquivos_bytes bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.nome,
    c.criado_em,
    -- O primeiro administrador é quem abriu a conta: é com ele que se fala.
    (select l.email from lojas l where l.conta_id = c.id and l.role = 'admin' order by l.criado_em limit 1),
    cc.plano,
    cc.limite_usuarios,
    cc.limite_armazenamento_mb,
    cc.limite_registros,
    (select count(*) from lojas l where l.conta_id = c.id and l.ativo)::integer,
    (select count(*) from lojas l where l.conta_id = c.id)::integer,
    uso.registros,
    uso.arquivos_bytes
  from contas c
  left join configuracoes_conta cc on cc.conta_id = c.id
  cross join lateral calcular_uso(c.id) uso
  order by c.criado_em desc
$$;

-- ---------------------------------------------------------------------------
-- Painel: ajustar os limites de uma empresa
-- ---------------------------------------------------------------------------

-- Nulo = sem limite. Devolve se a conta existe: o painel avisa em vez de fingir
-- que gravou. Reduzir o limite abaixo do uso atual é permitido: não apaga nada,
-- só impede de passar daí (os gatilhos e a rota de logins já fazem isso).
create function plataforma_alterar_limites(
  p_conta uuid,
  p_limite_usuarios integer,
  p_limite_armazenamento_mb integer,
  p_limite_registros integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from contas where id = p_conta) then
    return false;
  end if;

  -- Contas antigas podem não ter linha de configuração; sem esta, o `update`
  -- não acharia nada e o ajuste se perderia em silêncio.
  insert into configuracoes_conta (conta_id) values (p_conta) on conflict (conta_id) do nothing;

  update configuracoes_conta
     set limite_usuarios = p_limite_usuarios,
         limite_armazenamento_mb = p_limite_armazenamento_mb,
         limite_registros = p_limite_registros
   where conta_id = p_conta;
  return true;
end
$$;

-- ---------------------------------------------------------------------------
-- Excluir uma conta por completo
-- ---------------------------------------------------------------------------

-- Apaga TUDO da empresa e devolve os caminhos dos arquivos que estavam
-- registrados, pra rota apagar no R2 o que sobrar (ver rotas/exclusaoDeConta.ts).
--
-- A ordem importa: `quebras` e `estoque` apontam pra lojas, motivos, origens e
-- produtos com `on delete restrict`, então nenhum deles pode sobrar quando a
-- conta cair. `anexos` e `validades` saem em cascata junto. Tudo numa transação
-- só (a da chamada): ou a empresa inteira some, ou nada muda.
create function excluir_conta(p_conta uuid)
returns setof text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Os caminhos são lidos ANTES do delete: depois, o registro que aponta pro
  -- arquivo já não existe.
  return query
    select a.storage_path
      from anexos a
      join quebras q on q.id = a.quebra_id
      join lojas l on l.id = q.loja_id
     where l.conta_id = p_conta;

  delete from quebras where loja_id in (select id from lojas where conta_id = p_conta);
  delete from contagens where loja_id in (select id from lojas where conta_id = p_conta);
  delete from pedidos where loja_id in (select id from lojas where conta_id = p_conta);
  delete from estoque where loja_id in (select id from lojas where conta_id = p_conta);
  delete from produtos where conta_id = p_conta;

  -- Lojas, motivos, origens, configurações e tokens saem em cascata.
  delete from contas where id = p_conta;
end
$$;

-- ---------------------------------------------------------------------------
-- Dono das funções e quem pode chamar
-- ---------------------------------------------------------------------------

-- Mesma troca de dono das migrações 0003 e 0006.
grant create on schema public to app_definer;
alter function plataforma_listar_contas() owner to app_definer;
alter function plataforma_alterar_limites(uuid, integer, integer, integer) owner to app_definer;
alter function excluir_conta(uuid) owner to app_definer;
revoke create on schema public from app_definer;

revoke all on function plataforma_listar_contas() from public;
revoke all on function plataforma_alterar_limites(uuid, integer, integer, integer) from public;
revoke all on function excluir_conta(uuid) from public;

-- Só `app_auth` (pool de login/plataforma). A `app_runtime`, que atende as
-- telas dos clientes, NÃO ganha execute: um bug numa rota de cliente nunca chega
-- a poder listar ou apagar outra empresa. Quem confere se o chamador pode é a
-- rota, ANTES de chamar (administrador da plataforma, ou o administrador da
-- própria conta com a senha reconfirmada).
grant execute on function plataforma_listar_contas() to app_auth;
grant execute on function plataforma_alterar_limites(uuid, integer, integer, integer) to app_auth;
grant execute on function excluir_conta(uuid) to app_auth;

-- Down Migration

drop function if exists excluir_conta(uuid);
drop function if exists plataforma_alterar_limites(uuid, integer, integer, integer);
drop function if exists plataforma_listar_contas();

drop policy if exists definer_produtos_exclusao on produtos;
drop policy if exists definer_pedidos_exclusao on pedidos;
drop policy if exists definer_contagens_exclusao on contagens;
drop policy if exists definer_quebras_exclusao on quebras;
drop policy if exists definer_estoque_exclusao on estoque;

revoke update (limite_usuarios, limite_armazenamento_mb, limite_registros) on configuracoes_conta from app_definer;
revoke delete on estoque, quebras, contagens, pedidos, produtos from app_definer;
revoke delete on contas, configuracoes_conta from app_definer;
