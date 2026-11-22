-- REVIEW ONLY / NAO EXECUTAR. Corrige ordem SQL04 somente em Neon HML descartavel.
-- Nao instalar no banco sem autorizacao especifica, snapshot da HML,
-- bloqueio de novas escritas, drenagem de transacoes e manutencao.
-- Nao altera dados, RLS, grants, colunas nem SQL05/SQL06.
-- Parte de 04_optimistic_revision_drafts_PROPOSAL.sql, SEM o ALTER TABLE
-- original para impedir impacto de schema na correção de ordem.
-- Requer branch exata br-holy-term-b6v6ofea e banco rodizio_portas;
-- current_database() isoladamente NAO comprova branch. Conferir endpoint externo.
-- Concluir teste de JWT Admin: revisão obsoleta + escala publicada/travada
-- deve devolver P0001; revisão atual + estado invalido deve devolver 42501.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.rodizios, public.rodizio_itens IN ACCESS EXCLUSIVE MODE;
DO $preflight$
DECLARE v_source text;
BEGIN
 IF current_database() <> 'rodizio_portas' THEN
   RAISE EXCEPTION 'Banco inesperado; abortando' USING ERRCODE='42501';
 END IF;
 SELECT pg_get_functiondef(p.oid) INTO v_source FROM pg_proc p
  WHERE p.oid=to_regprocedure('public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint)');
 IF v_source IS NULL THEN
   RAISE EXCEPTION 'SQL04 nao instalada; abortando' USING ERRCODE='42501';
 END IF;
 IF position('if v_travado or v_status' IN lower(v_source))=0 OR
    position('if v_revisao_atual is distinct from p_revisao_esperada' IN lower(v_source))=0 OR
    position('if v_travado or v_status' IN lower(v_source)) >
    position('if v_revisao_atual is distinct from p_revisao_esperada' IN lower(v_source)) THEN
   RAISE EXCEPTION 'SQL04 instalada nao corresponde ao estado conhecido; abortando' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint)')
   AND NOT p.prosecdef AND pg_get_userbyid(p.proowner)='rodizio_portas_owner'
   AND (p.proconfig @> ARRAY['search_path=""']::text[]) IS TRUE) THEN
   RAISE EXCEPTION 'Owner, invoker ou search_path inesperado' USING ERRCODE='42501';
 END IF;
END;
$preflight$;

create or replace function public.substituir_itens_rodizio_rascunho_versionado(
  p_rodizio_id uuid,
  p_itens jsonb,
  p_revisao_esperada bigint
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_travado boolean;
  v_inicio date;
  v_fim date;
  v_total integer;
  v_revisao_atual bigint;
begin
  if (select public.usuario_atual_id()) is null or
     not (select public.usuario_tem_perfil('admin')) then
    raise exception 'Somente administrador autenticado pode gravar itens'
      using errcode = '42501';
  end if;

  if p_revisao_esperada is null or p_revisao_esperada < 0 then
    raise exception 'Revisao esperada obrigatoria e nao negativa' using errcode = '22023';
  end if;

  if p_rodizio_id is null or p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'ID da escala e array de itens sao obrigatorios'
      using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_itens);
  if v_total < 1 or v_total > 500 then
    raise exception 'Informe entre 1 e 500 itens por substituicao'
      using errcode = '22023';
  end if;

  -- Serializa chamadas desta funcao para o mesmo rodizio.
  -- O SELECT FOR UPDATE impede que outra chamada desta funcao observe
  -- estado intermediario; RLS e gatilhos continuam aplicados.
  select r.status, r.travado, r.data_inicio, r.data_fim, r.revisao
    into v_status, v_travado, v_inicio, v_fim, v_revisao_atual
    from public.rodizios r
   where r.id = p_rodizio_id
   for update;
  if not found then
    raise exception 'Escala nao encontrada ou inacessivel'
      using errcode = 'P0002';
  end if;
  -- Conferir OCC ANTES da validação de estado: se outra operação
  -- publicou/travou a escala desde que o editor a abriu, devolver P0001
  -- em vez de 42501. Ambos os testes ocorrem sob o mesmo row lock.
  if v_revisao_atual is distinct from p_revisao_esperada then
    raise exception 'Conflito de revisao. Atual %, esperada %', v_revisao_atual, p_revisao_esperada
      using errcode = 'P0001';
  end if;

  if v_travado or v_status <> 'rascunho' then
    raise exception 'Substituicao permitida somente em escala em rascunho nao travada'
      using errcode = '42501';
  end if;

  -- Validacao do JSON ANTES de remover os itens. Campos desconhecidos
  -- sao recusados, bem como datas fora do periodo e porta vazia.
  if exists (
    select 1
      from jsonb_array_elements(p_itens) as e(item)
     where jsonb_typeof(e.item) <> 'object'
        or (e.item - 'data' - 'porta' - 'periodo' - 'auxiliar_id' - 'observacoes') <> '{}'::jsonb
        or not (e.item ? 'data' and e.item ? 'porta')
        or jsonb_typeof(e.item->'data') <> 'string'
        or jsonb_typeof(e.item->'porta') <> 'string'
        or btrim(e.item->>'porta') = ''
  ) then
    raise exception 'Item invalido ou com campos inesperados'
      using errcode = '22023';
  end if;

  -- Parsing de data/uuid tambem ocorre antes do DELETE.
  -- Falhas de cast abortam integralmente a RPC.
  perform 1
    from jsonb_to_recordset(p_itens) as x(
      data date, porta text, periodo text, auxiliar_id uuid, observacoes text
    )
   where x.data < v_inicio or x.data > v_fim;
  if found then
    raise exception 'Existe item fora do intervalo da escala'
      using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_to_recordset(p_itens) as x(
        data date, porta text, periodo text, auxiliar_id uuid, observacoes text
      )
     where x.data is null
        or x.porta is null
        or btrim(x.porta) = ''
  ) then
    raise exception 'Data e porta sao obrigatorias em cada item'
      using errcode = '22023';
  end if;

  delete from public.rodizio_itens
   where rodizio_id = p_rodizio_id;

  insert into public.rodizio_itens (
    rodizio_id, data, porta, periodo, auxiliar_id, observacoes
  )
  select p_rodizio_id,
         x.data,
         btrim(x.porta),
         nullif(x.periodo, ''),
         x.auxiliar_id,
         x.observacoes
    from jsonb_to_recordset(p_itens) as x(
      data date, porta text, periodo text, auxiliar_id uuid, observacoes text
    );

  -- A revisão sobe na mesma transação que o DELETE/INSERT.
  -- Em qualquer erro posterior ou durante INSERT, tudo faz ROLLBACK.
  update public.rodizios
     set revisao = revisao + 1
   where id = p_rodizio_id and revisao = p_revisao_esperada;
  if not found then
    raise exception 'Conflito ao incrementar revisao' using errcode = 'P0001';
  end if;

  return v_total;
end;
$$;

DO $postflight$
DECLARE v_source text;
BEGIN
 SELECT pg_get_functiondef('public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint)'::regprocedure)
  INTO v_source;
 IF position('if v_revisao_atual is distinct from p_revisao_esperada' IN lower(v_source))=0 OR
    position('if v_travado or v_status' IN lower(v_source))=0 OR
    position('if v_revisao_atual is distinct from p_revisao_esperada' IN lower(v_source)) >
    position('if v_travado or v_status' IN lower(v_source)) THEN
   RAISE EXCEPTION 'Ordem SQL04 nao corrigida; rollback' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint)'::regprocedure
   AND NOT p.prosecdef AND pg_get_userbyid(p.proowner)='rodizio_portas_owner'
   AND (p.proconfig @> ARRAY['search_path=""']::text[]) IS TRUE) THEN
   RAISE EXCEPTION 'Atributos SQL04 inesperados; rollback' USING ERRCODE='42501';
 END IF;
END;
$postflight$;
COMMIT;

-- Continuar mantendo escritas suspensas ate testes reais JWT/concorrencia.
-- Nao executar SQL12 hardening antes da homologacao da SQL04.
