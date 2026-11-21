-- Read-only, aggregate-only preflight for duplicate identities.
-- Run on the Supabase source before planning deduplication; never return
-- user IDs, names, email addresses, passwords or authentication secrets.
-- Does NOT authorize changes to auth or to usuarios_auxiliares.
SELECT
  COUNT(*)::int AS grupos_duplicados,
  COALESCE(SUM(g.vinculos - 1), 0)::int AS vinculos_excedentes,
  COALESCE(SUM((g.perfis_distintos > 1)::int),0)::int AS grupos_com_conflito_perfil,
  COALESCE(SUM((g.auxiliares_distintas > 1)::int),0)::int AS grupos_com_conflito_auxiliar,
  COALESCE(SUM(((g.auxiliares_nulas > 0) AND (g.auxiliares_nulas < g.vinculos))::int),0)::int AS grupos_com_mistura_auxiliar_nula
FROM (
  SELECT user_id,
         COUNT(*) AS vinculos,
         COUNT(DISTINCT perfil) AS perfis_distintos,
         COUNT(DISTINCT auxiliar_id) AS auxiliares_distintas,
         COUNT(*) FILTER (WHERE auxiliar_id IS NULL) AS auxiliares_nulas
  FROM public.usuarios_auxiliares
  GROUP BY user_id
  HAVING COUNT(*) > 1
) g;
