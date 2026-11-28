-- Inventario de dados sem PII e SEM ESCRITA.
-- Usar somente no SQL Editor Supabase da origem ou no Neon isolado autorizado.
-- Nao inclui emails, nomes, telefones, carteirinhas, registros nem tokens.
-- Resultado sem IDs: preserva contagens/invariantes, NAO e backup/restauracao.
SELECT current_database() AS database_name,
       jsonb_build_object(
         'auxiliares',(SELECT count(*) FROM public.auxiliares),
         'restricoes_auxiliares',(SELECT count(*) FROM public.restricoes_auxiliares),
         'rodizios',(SELECT count(*) FROM public.rodizios),
         'rodizio_itens',(SELECT count(*) FROM public.rodizio_itens),
         'usuarios_auxiliares',(SELECT count(*) FROM public.usuarios_auxiliares)
       ) AS contagens,
       jsonb_build_object(
         'rascunho',(SELECT count(*) FROM public.rodizios WHERE status='rascunho'),
         'publicado',(SELECT count(*) FROM public.rodizios WHERE status='publicado'),
         'travado',(SELECT count(*) FROM public.rodizios WHERE status='travado'),
         'cancelado',(SELECT count(*) FROM public.rodizios WHERE status='cancelado')
       ) AS status_rodizios,
       jsonb_build_object(
         'admin',(SELECT count(*) FROM public.usuarios_auxiliares WHERE perfil='admin'),
         'coordenadora',(SELECT count(*) FROM public.usuarios_auxiliares WHERE perfil='coordenadora'),
         'auxiliar',(SELECT count(*) FROM public.usuarios_auxiliares WHERE perfil='auxiliar')
       ) AS perfis,
       jsonb_build_object(
         'rodizios_intervalo_invertido',
            (SELECT count(*) FROM public.rodizios WHERE data_inicio > data_fim),
         'itens_sem_rodizio',
            (SELECT count(*) FROM public.rodizio_itens i LEFT JOIN public.rodizios r ON r.id=i.rodizio_id WHERE r.id IS NULL),
         'itens_auxiliar_inexistente',
            (SELECT count(*) FROM public.rodizio_itens i LEFT JOIN public.auxiliares a ON a.id=i.auxiliar_id WHERE i.auxiliar_id IS NOT NULL AND a.id IS NULL),
         'restricoes_auxiliar_inexistente',
            (SELECT count(*) FROM public.restricoes_auxiliares x LEFT JOIN public.auxiliares a ON a.id=x.auxiliar_id WHERE a.id IS NULL),
         'itens_fora_periodo',
            (SELECT count(*) FROM public.rodizio_itens i JOIN public.rodizios r ON r.id=i.rodizio_id
             WHERE i.data < r.data_inicio OR i.data > r.data_fim),
         'rodizios_travados_sem_flag',
            (SELECT count(*) FROM public.rodizios WHERE status='travado' AND travado IS DISTINCT FROM true)
       ) AS inconsistencias;
