-- Up Migration

-- O operador precisa poder criar produto PENDENTE DE CADASTRO (ver
-- docs/dominio.md: importação de estoque com SKU desconhecido e registro de
-- quebra de um produto fora do cadastro). A política `produtos_insert` só
-- deixa o administrador inserir, então sem esta o operador tomava erro de RLS
-- justamente nos dois fluxos em que "não bloquear" é a regra.
--
-- Políticas permissivas se somam (OR): o admin continua coberto por
-- `produtos_insert`; esta só abre o que o operador pode fazer, e só isso:
--   * pendente_cadastro = true  → nunca cria um produto já "completo";
--   * loja_origem_id = a loja dele → a fila do admin sempre mostra de onde
--     veio o pedido, e ninguém declara outra loja como origem.
-- Alterar ou excluir produto continua exclusivo do administrador.
create policy produtos_insert_pendente on produtos for insert
  with check (
    conta_id = app_conta_id()
    and pendente_cadastro = true
    and loja_origem_id = app_loja_id()
  );

-- Down Migration

drop policy if exists produtos_insert_pendente on produtos;
