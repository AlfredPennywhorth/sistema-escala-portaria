-- Auditoria agregada da superficie de escrita de escalas no Neon.
-- SOMENTE SELECT. Executar somente na branch descartavel autorizada.
-- Esta consulta reporta exposicao potencial; RLS/Admin devem ser testados separadamente.
-- Nunca marca GO enquanto houver DML direto ou RPC legada com EXECUTE.
WITH expected_rpc(name) AS (
  VALUES
    ('criar_rodizio_rascunho_versionado'),
    ('atualizar_cabecalho_rascunho_versionado'),
    ('substituir_itens_rodizio_rascunho_versionado'),
    ('publicar_rodizio_versionado'),
    ('travar_rodizio_versionado'),
    ('cancelar_rodizio_versionado'),
    ('excluir_rodizio_rascunho_versionado')
), tables AS (
  SELECT c.relname AS table_name,
    has_table_privilege('authenticated',c.oid,'INSERT') AS direct_insert,
    has_table_privilege('authenticated',c.oid,'UPDATE') AS direct_update,
    has_table_privilege('authenticated',c.oid,'DELETE') AS direct_delete,
    has_any_column_privilege('authenticated',c.oid,'INSERT') AS column_insert,
    has_any_column_privilege('authenticated',c.oid,'UPDATE') AS column_update,
    has_any_column_privilege('anonymous',c.oid,'INSERT') AS anonymous_column_insert,
    has_any_column_privilege('anonymous',c.oid,'UPDATE') AS anonymous_column_update,
    c.relrowsecurity AS rls_enabled
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('rodizios','rodizio_itens')
    AND c.relkind IN ('r','p')
), versioned AS (
  SELECT e.name,
    COUNT(p.oid)::int AS signatures,
    COALESCE(BOOL_AND(has_function_privilege('authenticated',p.oid,'EXECUTE')),false) AS auth_can_execute,
    COALESCE(BOOL_OR(has_function_privilege('anonymous',p.oid,'EXECUTE')),false) AS anonymous_can_execute,
    COALESCE(BOOL_AND(p.prosecdef),false) AS all_security_definer,
    COALESCE(BOOL_AND((p.proconfig @> ARRAY['search_path=""']::text[]) IS TRUE),false) AS all_fixed_search_path
  FROM expected_rpc e
  LEFT JOIN pg_proc p ON p.proname=e.name
    AND p.pronamespace='public'::regnamespace
  GROUP BY e.name
), legacy AS (
  SELECT COUNT(*)::int AS signatures,
    COALESCE(BOOL_OR(has_function_privilege('authenticated',p.oid,'EXECUTE')),false) AS auth_can_execute,
    COALESCE(BOOL_OR(has_function_privilege('anonymous',p.oid,'EXECUTE')),false) AS anonymous_can_execute
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    AND p.proname='substituir_itens_rodizio_rascunho'
)
SELECT
  (SELECT COUNT(*)::int FROM tables) AS tables_found,
  (SELECT COUNT(*)::int FROM tables WHERE direct_insert OR direct_update OR direct_delete) AS tables_with_direct_dml,
  (SELECT COUNT(*)::int FROM tables WHERE column_insert OR column_update OR anonymous_column_insert OR anonymous_column_update) AS tables_with_effective_column_dml,
  (SELECT COUNT(*)::int FROM tables WHERE NOT rls_enabled) AS tables_without_rls,
  (SELECT COUNT(*)::int FROM versioned WHERE signatures<>1) AS versioned_rpc_missing_or_overloaded,
  (SELECT COUNT(*)::int FROM versioned WHERE NOT auth_can_execute) AS versioned_rpc_without_auth_execute,
  (SELECT COUNT(*)::int FROM versioned WHERE anonymous_can_execute) AS versioned_rpc_exposed_to_anonymous,
  (SELECT COUNT(*)::int FROM versioned WHERE NOT all_security_definer) AS versioned_rpc_not_all_definer,
  (SELECT COUNT(*)::int FROM versioned WHERE NOT all_fixed_search_path) AS versioned_rpc_without_fixed_search_path,
  (SELECT signatures FROM legacy) AS legacy_rpc_signatures,
  (SELECT auth_can_execute FROM legacy) AS legacy_rpc_auth_executable,
  (SELECT anonymous_can_execute FROM legacy) AS legacy_rpc_anonymous_executable,
  (SELECT COUNT(*)=2 AND COUNT(*) FILTER(WHERE direct_insert OR direct_update OR direct_delete OR column_insert OR column_update OR anonymous_column_insert OR anonymous_column_update)=0
   AND COUNT(*) FILTER(WHERE NOT rls_enabled)=0 FROM tables) AS direct_dml_closed,
  (SELECT signatures=0 OR NOT auth_can_execute FROM legacy) AS legacy_authenticated_closed;
