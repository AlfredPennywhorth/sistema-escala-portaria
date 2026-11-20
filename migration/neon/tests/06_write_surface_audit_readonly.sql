-- Auditoria READ-ONLY da superficie de escrita (SQL 06 - preflight).
-- Executar somente na branch Neon descartavel / HML autorizada.
-- Nao revoga grants, altera RLS, chama RPC, modifica tabelas ou dados.
-- Resultado gate_fechado = false e esperado no estado atual; NAO promover producao.
WITH privileges AS (
  SELECT
    c.relname AS tabela,
    has_table_privilege('authenticated',c.oid,'INSERT') AS insert_direto,
    has_table_privilege('authenticated',c.oid,'UPDATE') AS update_direto,
    has_table_privilege('authenticated',c.oid,'DELETE') AS delete_direto,
    c.relrowsecurity AS rls_habilitada,
    c.relforcerowsecurity AS rls_forcada
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('rodizios','rodizio_itens')
    AND c.relkind IN ('r','p')
),
rpc AS (
  SELECT
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS assinatura,
    p.prosecdef AS security_definer,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS executavel_authenticated,
    has_function_privilege('anonymous',p.oid,'EXECUTE') AS executavel_anonymous
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'substituir_itens_rodizio_rascunho',
    'substituir_itens_rodizio_rascunho_versionado',
    'publicar_rodizio_versionado',
    'travar_rodizio_versionado'
  )
)
SELECT 'tabela' AS tipo, tabela AS objeto,
       insert_direto OR update_direto OR delete_direto AS bypass_potencial,
       jsonb_build_object('insert',insert_direto,'update',update_direto,
         'delete',delete_direto,'rls',rls_habilitada,'force_rls',rls_forcada) AS detalhes
FROM privileges
UNION ALL
SELECT 'rpc',proname||'('||assinatura||')',
       proname='substituir_itens_rodizio_rascunho' AND executavel_authenticated,
       jsonb_build_object('security_definer',security_definer,
         'authenticated',executavel_authenticated,'anonymous',executavel_anonymous)
FROM rpc
ORDER BY tipo,objeto;
