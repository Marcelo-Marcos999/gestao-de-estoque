-- Up Migration

-- Quem é a loja, de qual conta e com que papel não se muda por UPDATE.
--
-- Até aqui a role do app podia atualizar QUALQUER coluna de `lojas`, e a
-- política de RLS só conferia a conta. Isso deixava de pé um caminho de
-- escalada: um operador que conseguisse rodar um UPDATE na própria linha (por
-- um bug de injeção de SQL numa rota, por exemplo) poderia trocar o próprio
-- `role` para 'admin'. A política não enxerga colunas; o privilégio enxerga.
--
-- Agora o app só altera nome, ativo e senha. `role`, `email` e `conta_id`
-- ficam fixos depois de criados (mudar o papel de alguém é desativar e criar
-- de novo), e criar um login continua sendo um INSERT, que só o admin faz
-- (política `lojas_insert`).
revoke update on lojas from app_runtime;
grant update (nome, ativo, senha_hash, senha_alterada_em) on lojas to app_runtime;

-- Down Migration

revoke update (nome, ativo, senha_hash, senha_alterada_em) on lojas from app_runtime;
grant update on lojas to app_runtime;
