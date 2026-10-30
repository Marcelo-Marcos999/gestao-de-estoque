-- Up Migration

-- O período do relatório de saídas passa a morar no login, não no navegador.
--
-- É a janela de dias que o arquivo de saídas cobre, e entra direto na previsão
-- de "quantos dias o estoque leva para zerar" (docs/dominio.md). Gravado só no
-- navegador, ele mudava de um aparelho para outro e dava faixas diferentes para
-- o mesmo lote. Cada login edita o seu, então a coluna é de `lojas`.
--
-- NULL = a pessoa nunca definiu; o front usa o padrão (390). Guardar o padrão
-- em vez de NULL travaria uma mudança futura dele para quem nunca mexeu.
alter table lojas
  add column periodo_saidas_dias integer
  check (periodo_saidas_dias between 1 and 3650);

-- A migration 0004 deixou o app alterar só colunas escolhidas de `lojas`
-- (para um operador não poder trocar o próprio `role`). Esta entra na lista;
-- quem pode alterá-la em cada linha continua sendo a política de RLS.
grant update (periodo_saidas_dias) on lojas to app_runtime;

-- Down Migration

revoke update (periodo_saidas_dias) on lojas from app_runtime;
alter table lojas drop column periodo_saidas_dias;
