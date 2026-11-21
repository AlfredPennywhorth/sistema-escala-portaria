-- PRE-FLIGHT SQL 06 — somente leitura.
-- Destino obrigatório: projeto blue-sky-02214231,
-- branch descartável br-holy-term-b6v6ofea; banco rodizio_portas.
-- NUNCA executar no Neon main, HML principal ou produção.
-- Este script NÃO instala funções, não grava e não altera grants.

WITH funcoes(nome,assinatura) AS (
  VALUES
    ('criar_rodizio_rascunho_versionado',
     'public.criar_rodizio_rascunho_versionado(text,date,date,text)'),
    ('atualizar_cabecalho_rascunho_versionado',
     'public.atualizar_cabecalho_rascunho_versionado(uuid,bigint,text,date,date,text)'),
    ('cancelar_rodizio_versionado',
     'public.cancelar_rodizio_versionado(uuid,bigint)'),
    ('excluir_rodizio_rascunho_versionado',
     'public.excluir_rodizio_rascunho_versionado(uuid,bigint)')
)
SELECT current_database() AS banco,
       current_user AS role_sql,
       f.nome AS funcao_sql06,
       to_regprocedure(f.assinatura) IS NOT NULL AS instalada,
       (SELECT count(*) FROM public.rodizios)::int AS total_escalas,
       (SELECT count(*) FROM public.rodizio_itens)::int AS total_itens
FROM funcoes f ORDER BY f.nome;

-- Baseline: auditar apenas os identificadores das fixtures de homologação;
-- registrar títulos e conteúdo integral separadamente em ambiente restrito
-- antes de qualquer ensaio de mutação.
SELECT r.id,r.titulo,r.status,r.travado,r.revisao,r.travado_em,
       count(i.id)::int AS itens
FROM public.rodizios r
LEFT JOIN public.rodizio_itens i ON i.rodizio_id=r.id
WHERE r.id IN ('00000000-0000-4000-8000-000000000206'::uuid,
               '00000000-0000-4000-8000-000000000207'::uuid,
               '00000000-0000-4000-8000-000000000208'::uuid)
GROUP BY r.id ORDER BY r.id;
