-- Preflight read-only de incompatibilidades da migracao Supabase -> Neon.
-- So metadados/contagens. Nunca expor UUID, email, nomes ou tokens.
SELECT
  (SELECT COUNT(*)::int FROM (
      SELECT user_id FROM public.usuarios_auxiliares
      GROUP BY user_id HAVING COUNT(*) > 1
   ) x) AS identidades_com_vinculos_duplicados,
  (SELECT COALESCE(SUM(q.n - 1),0)::int FROM (
      SELECT COUNT(*) AS n FROM public.usuarios_auxiliares
      GROUP BY user_id HAVING COUNT(*) > 1
   ) q) AS vinculos_excedentes,
  EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='usuarios_auxiliares'
      AND c.contype='u' AND pg_get_constraintdef(c.oid) LIKE '%(user_id)%'
  ) AS user_id_unico_por_constraint,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='restricoes_auxiliares'
      AND indexname='idx_restricoes_ativa'
  ) AS indice_restricoes_ativas_presente,
  (SELECT COUNT(*)::int FROM public.rodizio_itens i
   JOIN public.rodizios r ON r.id=i.rodizio_id
   WHERE r.travado=true AND (i.data<r.data_inicio OR i.data>r.data_fim)
  ) AS itens_historicos_fora_intervalo,
  (SELECT COUNT(*)::int FROM pg_trigger tr JOIN pg_class t ON t.oid=tr.tgrelid
   JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='rodizio_itens'
     AND NOT tr.tgisinternal AND (tr.tgtype & 4) = 4
  ) AS gatilhos_insert_itens;
