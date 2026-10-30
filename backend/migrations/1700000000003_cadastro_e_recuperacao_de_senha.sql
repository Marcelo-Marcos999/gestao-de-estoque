-- Up Migration

-- Criar conta, confirmar e-mail e recuperar senha.
--
-- Decisão de segurança que guia esta migration: a role do login (`app_auth`)
-- NÃO ganha nenhum privilégio novo em tabela. Tudo o que é sensível mora em
-- funções do banco, e as que mudam senha ou confirmam e-mail exigem o token
-- DENTRO da própria função. Assim, mesmo que a credencial do login vaze, ela
-- só consegue chamar essas funções — e sem um token válido nenhuma delas muda
-- a senha de ninguém.

-- ---------------------------------------------------------------------------
-- Colunas novas em lojas
-- ---------------------------------------------------------------------------

-- Conta nova só entra depois de confirmar o e-mail. O DEFAULT now() abaixo é
-- só pra preencher quem já existe (criado à mão antes desta migration) sem
-- trancar ninguém pra fora; logo em seguida o default sai, então toda loja
-- criada daqui pra frente nasce NÃO confirmada. (Não dá pra fazer isso com um
-- UPDATE: a RLS é forçada até pro dono da tabela, e o UPDATE não enxergaria
-- linha nenhuma.)
alter table lojas add column email_confirmado_em timestamptz default now();
alter table lojas alter column email_confirmado_em drop default;

-- Quando a senha mudou pela última vez. O refresh token dura 7 dias e não dá
-- pra revogar um JWT; em vez de guardar lista de tokens, a rota de refresh
-- recusa qualquer token emitido antes desta data. Trocar a senha encerra
-- todas as sessões abertas.
alter table lojas add column senha_alterada_em timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Tokens de e-mail
-- ---------------------------------------------------------------------------

create type token_email_tipo as enum ('confirmar-email', 'redefinir-senha');

-- Guarda só o HASH do token. O token de verdade existe uma vez, no link do
-- e-mail: quem lesse esta tabela não conseguiria usar nenhum.
create table tokens_email (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  tipo token_email_tipo not null,
  token_hash text not null unique,
  expira_em timestamptz not null,
  -- Preenchido ao usar. Token de uso único: nunca volta a valer.
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index tokens_email_loja on tokens_email (loja_id, tipo) where usado_em is null;

alter table tokens_email enable row level security;
alter table tokens_email force row level security;

-- Nem a role do app nem a do login enxergam esta tabela: sem política e sem
-- privilégio. Só as funções abaixo mexem nela.
revoke all on tokens_email from app_runtime;

-- ---------------------------------------------------------------------------
-- Role dona das funções
-- ---------------------------------------------------------------------------

-- Sem login e sem poder de dono: só tem o que as funções precisam, e as
-- políticas abaixo dizem exatamente em quais tabelas.
do $$
begin
  if not exists (select from pg_roles where rolname = 'app_definer') then
    create role app_definer nologin;
  end if;
  -- Pra poder entregar a ela a dona das funções.
  execute format('grant app_definer to %I', current_user);
end
$$;

grant usage on schema public to app_definer;
grant select, insert on contas, configuracoes_conta, motivos, origens to app_definer;
grant select, insert, update on lojas to app_definer;
grant select, insert, update, delete on tokens_email to app_definer;

create policy definer_contas on contas for all to app_definer using (true) with check (true);
create policy definer_configuracoes on configuracoes_conta for all to app_definer using (true) with check (true);
create policy definer_motivos on motivos for all to app_definer using (true) with check (true);
create policy definer_origens on origens for all to app_definer using (true) with check (true);
create policy definer_lojas on lojas for all to app_definer using (true) with check (true);
create policy definer_tokens on tokens_email for all to app_definer using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Cria conta + loja administradora + configurações + motivos e origens padrão,
-- tudo ou nada. Devolve o id da loja, ou NULL se o e-mail já existe — a rota
-- responde igual nos dois casos, pra o cadastro não servir de lista de e-mails.
create function criar_conta(
  p_nome_conta text,
  p_nome_loja text,
  p_email text,
  p_senha_hash text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta uuid := gen_random_uuid();
  v_loja uuid := gen_random_uuid();
begin
  insert into contas (id, nome) values (v_conta, p_nome_conta);
  insert into configuracoes_conta (conta_id) values (v_conta);
  insert into lojas (id, conta_id, nome, email, senha_hash, role)
    values (v_loja, v_conta, p_nome_loja, lower(p_email), p_senha_hash, 'admin');

  insert into motivos (conta_id, label, embutido)
    select v_conta, label, true
    from unnest(array['Vencido', 'Danificado', 'Avaria de transporte',
                      'Divergência de quantidade', 'Furto ou perda']) as label;
  insert into origens (conta_id, label, embutido)
    select v_conta, label, true
    from unnest(array['Centro de distribuição', 'Loja', 'Fornecedor']) as label;

  return v_loja;
exception
  -- O bloco inteiro desfaz junto: não sobra uma conta sem loja.
  when unique_violation then
    return null;
end
$$;

-- Registra um token novo pra loja com esse e-mail e devolve pra quem enviar.
-- Não devolve nada (e não diz por quê) quando não há o que enviar: e-mail
-- inexistente, conta desativada, e-mail já confirmado ou pedido repetido em
-- menos de um minuto (segura quem aperta o botão em sequência e impede de usar
-- o formulário pra encher a caixa de entrada de alguém).
create function solicitar_token(
  p_email text,
  p_tipo token_email_tipo,
  p_token_hash text,
  p_validade interval
) returns table (loja_nome text, loja_email text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja lojas%rowtype;
begin
  -- Higiene: token vencido há mais de uma semana não serve pra mais nada.
  delete from tokens_email where expira_em < now() - interval '7 days';

  select * into v_loja from lojas where email = lower(p_email) and ativo;
  if not found then
    return;
  end if;

  if p_tipo = 'confirmar-email' and v_loja.email_confirmado_em is not null then
    return;
  end if;

  if exists (
    select 1 from tokens_email
    where loja_id = v_loja.id and tipo = p_tipo and criado_em > now() - interval '1 minute'
  ) then
    return;
  end if;

  -- Só o link mais recente vale.
  update tokens_email set usado_em = now()
    where loja_id = v_loja.id and tipo = p_tipo and usado_em is null;

  insert into tokens_email (loja_id, tipo, token_hash, expira_em)
    values (v_loja.id, p_tipo, p_token_hash, now() + p_validade);

  return query select v_loja.nome, v_loja.email;
end
$$;

-- Consome o token (uma vez só, atomicamente) e confirma o e-mail da loja.
create function confirmar_email_com_token(p_token_hash text) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja uuid;
begin
  update tokens_email set usado_em = now()
    where token_hash = p_token_hash
      and tipo = 'confirmar-email'
      and usado_em is null
      and expira_em > now()
    returning loja_id into v_loja;

  if v_loja is null then
    return false;
  end if;

  update lojas set email_confirmado_em = coalesce(email_confirmado_em, now())
    where id = v_loja;
  return true;
end
$$;

-- Consome o token e troca a senha. A senha só muda aqui dentro, junto com o
-- token: sem token válido, nenhum caminho por esta função altera nada.
-- Receber o link de recuperação prova que a pessoa controla o e-mail, então
-- também confirma o e-mail (quem se cadastrou, não confirmou e esqueceu a
-- senha não fica preso).
create function redefinir_senha_com_token(p_token_hash text, p_senha_hash text) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja uuid;
begin
  update tokens_email set usado_em = now()
    where token_hash = p_token_hash
      and tipo = 'redefinir-senha'
      and usado_em is null
      and expira_em > now()
    returning loja_id into v_loja;

  if v_loja is null then
    return false;
  end if;

  update lojas
    set senha_hash = p_senha_hash,
        senha_alterada_em = now(),
        email_confirmado_em = coalesce(email_confirmado_em, now())
    where id = v_loja;

  -- Qualquer outro link pendente dessa loja morre junto.
  update tokens_email set usado_em = now() where loja_id = v_loja and usado_em is null;
  return true;
end
$$;

-- As funções ficam com a role limitada, não com o dono.
--
-- O Postgres só deixa passar a posse de uma função pra uma role que tenha
-- permissão de CRIAR no schema. A permissão vale só durante a troca e é
-- retirada logo depois: `app_definer` não precisa (nem deve) poder criar
-- objetos, só ser dona dessas quatro funções.
grant create on schema public to app_definer;
alter function criar_conta(text, text, text, text) owner to app_definer;
alter function solicitar_token(text, token_email_tipo, text, interval) owner to app_definer;
alter function confirmar_email_com_token(text) owner to app_definer;
alter function redefinir_senha_com_token(text, text) owner to app_definer;
revoke create on schema public from app_definer;

-- Só o login pode chamar. O padrão do Postgres é qualquer um (PUBLIC) poder
-- executar uma função nova; isso tira.
revoke all on function criar_conta(text, text, text, text) from public;
revoke all on function solicitar_token(text, token_email_tipo, text, interval) from public;
revoke all on function confirmar_email_com_token(text) from public;
revoke all on function redefinir_senha_com_token(text, text) from public;

grant execute on function criar_conta(text, text, text, text) to app_auth;
grant execute on function solicitar_token(text, token_email_tipo, text, interval) to app_auth;
grant execute on function confirmar_email_com_token(text) to app_auth;
grant execute on function redefinir_senha_com_token(text, text) to app_auth;

-- Down Migration

drop function if exists redefinir_senha_com_token(text, text);
drop function if exists confirmar_email_com_token(text);
drop function if exists solicitar_token(text, token_email_tipo, text, interval);
drop function if exists criar_conta(text, text, text, text);

drop policy if exists definer_tokens on tokens_email;
drop policy if exists definer_lojas on lojas;
drop policy if exists definer_origens on origens;
drop policy if exists definer_motivos on motivos;
drop policy if exists definer_configuracoes on configuracoes_conta;
drop policy if exists definer_contas on contas;

drop table if exists tokens_email;
drop type if exists token_email_tipo;

alter table lojas drop column if exists senha_alterada_em;
alter table lojas drop column if exists email_confirmado_em;

drop owned by app_definer;
drop role if exists app_definer;
