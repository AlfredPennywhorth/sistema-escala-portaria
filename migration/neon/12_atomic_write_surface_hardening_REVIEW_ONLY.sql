-- PROPOSTA P0 PARA REVISAO: NAO EXECUTAR AUTOMATICAMENTE.
-- Somente branch Neon descartavel br-holy-term-b6v6ofea, apos autorizacao especifica.
-- Nunca executar na origem Supabase, Neon main ou Cloudflare producao.
-- PRECONDICAO OBRIGATORIA: bloquear todos os ingressos de novas escritas,
-- drenar transacoes ja iniciadas e verificar zero escritores pendentes.
-- Snapshots, criterios de abortagem e rollback em:
-- docs/PLANO_FECHAMENTO_ATOMICO_ESCRITAS_NEON_20261122.md
-- BLOQUEIO ADICIONAL ATUAL: SQL04 instalada possui a ordem de verificacao
-- estado-antes-revisao, diferente da proposta revision-first; corrigir
-- e homologar SQL04 separadamente antes de executar este pacote.
-- Esta transacao nao modifica o corpo das sete RPCs; ALTER SECURITY DEFINER
-- faz executar com privilegios do owner (que contorna RLS da tabela).
-- REVISAO OBRIGATORIA do owner, auth.uid(), assinatura JWT e dos checks admin.
--
-- NAO RODAR COMO TESTE DE CI; NAO EXECUTAR ATE A REVISAO DO CODEX.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Uma janela de manutencao validada externamente e obrigatoria.
-- LOCK aguarda escritores com transacoes abertas; lock_timeout aborta
-- a transacao se nao conseguir lock rapidamente, sem estado parcial.
LOCK TABLE public.rodizios, public.rodizio_itens IN ACCESS EXCLUSIVE MODE;

DO $preflight$
DECLARE
  v_count integer;
  v_bad integer;
  v_ddl text;
BEGIN
  IF current_database() <> 'rodizio_portas' THEN
    RAISE EXCEPTION 'Database inesperado: encerrando sem aplicar' USING ERRCODE='42501';
  END IF;
  -- Nome do banco sozinho NAO identifica branch; confirmar branch e endpoint
  -- em painel de controle antes de qualquer execucao.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('rodizios','rodizio_itens')
      AND (pg_get_userbyid(c.relowner) <> 'rodizio_portas_owner' OR NOT c.relrowsecurity)
  ) THEN
    RAISE EXCEPTION 'Owner ou RLS das tabelas inesperado' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('rodizios','rodizio_itens');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Tabelas de escala ausentes' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_count FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.proname IN (
      'criar_rodizio_rascunho_versionado','atualizar_cabecalho_rascunho_versionado',
      'substituir_itens_rodizio_rascunho_versionado','publicar_rodizio_versionado',
      'travar_rodizio_versionado','cancelar_rodizio_versionado',
      'excluir_rodizio_rascunho_versionado'
    );
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'Assinaturas RPC inesperadas' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_bad FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.proname IN (
      'criar_rodizio_rascunho_versionado','atualizar_cabecalho_rascunho_versionado',
      'substituir_itens_rodizio_rascunho_versionado','publicar_rodizio_versionado',
      'travar_rodizio_versionado','cancelar_rodizio_versionado',
      'excluir_rodizio_rascunho_versionado'
    ) AND (
      pg_get_userbyid(p.proowner) <> 'rodizio_portas_owner'
      OR (p.proconfig @> ARRAY['search_path=""']::text[]) IS NOT TRUE
      OR p.prosecdef
      OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
    );
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'RPCs com owner/config/permissoes inesperados'
      USING ERRCODE='42501';
  END IF;
  SELECT pg_get_functiondef(p.oid) INTO v_ddl FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace
      AND p.proname='substituir_itens_rodizio_rascunho_versionado';
  -- BLOQUEIO DELIBERADO: versao instalada ainda avalia travado/status
  -- antes da revisao. Impedir rollout ate instalar SQL04 revision-first.
  IF v_ddl IS NULL OR
     position('if v_revisao_atual is distinct from p_revisao_esperada' IN lower(v_ddl))=0 OR
     position('if v_travado or v_status' IN lower(v_ddl))=0 OR
     position('if v_revisao_atual is distinct from p_revisao_esperada' IN lower(v_ddl)) >
     position('if v_travado or v_status' IN lower(v_ddl)) THEN
    RAISE EXCEPTION 'SQL04 deve validar revisao ANTES do estado; bloqueado'
      USING ERRCODE='42501';
  END IF;
END;
$preflight$;

-- ATENCAO: security definer concede acesso owner, exige checks JWT/admin
-- existentes. Nenhuma function body nova, nenhuma mudança de usuario.
ALTER FUNCTION public.criar_rodizio_rascunho_versionado(text,date,date,text) SECURITY DEFINER;
ALTER FUNCTION public.atualizar_cabecalho_rascunho_versionado(uuid,bigint,text,date,date,text) SECURITY DEFINER;
ALTER FUNCTION public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint) SECURITY DEFINER;
ALTER FUNCTION public.publicar_rodizio_versionado(uuid,bigint) SECURITY DEFINER;
ALTER FUNCTION public.travar_rodizio_versionado(uuid,bigint) SECURITY DEFINER;
ALTER FUNCTION public.cancelar_rodizio_versionado(uuid,bigint) SECURITY DEFINER;
ALTER FUNCTION public.excluir_rodizio_rascunho_versionado(uuid,bigint) SECURITY DEFINER;

-- Fechar todas as permissoes diretas de mutacao dos dois recursos.
-- O owner continua podendo gravar por dentro da RPC revisada.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.rodizios,public.rodizio_itens
  FROM PUBLIC, anonymous, authenticated;

-- Fechar a RPC sem OCC sem destrui-la, permitindo rollback coordenado.
REVOKE EXECUTE ON FUNCTION public.substituir_itens_rodizio_rascunho(uuid,jsonb)
  FROM PUBLIC, anonymous, authenticated;

-- Impedir ampliação inadvertida para a role PUBLIC.
REVOKE EXECUTE ON FUNCTION
  public.criar_rodizio_rascunho_versionado(text,date,date,text),
  public.atualizar_cabecalho_rascunho_versionado(uuid,bigint,text,date,date,text),
  public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint),
  public.publicar_rodizio_versionado(uuid,bigint),
  public.travar_rodizio_versionado(uuid,bigint),
  public.cancelar_rodizio_versionado(uuid,bigint),
  public.excluir_rodizio_rascunho_versionado(uuid,bigint)
  FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION
  public.criar_rodizio_rascunho_versionado(text,date,date,text),
  public.atualizar_cabecalho_rascunho_versionado(uuid,bigint,text,date,date,text),
  public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint),
  public.publicar_rodizio_versionado(uuid,bigint),
  public.travar_rodizio_versionado(uuid,bigint),
  public.cancelar_rodizio_versionado(uuid,bigint),
  public.excluir_rodizio_rascunho_versionado(uuid,bigint)
  TO authenticated;

-- Postflight no MESMO commit: falha faz rollback integral do pacote.
-- Inclui grants por coluna, inclusive efetivos via heranca de roles.
-- Nao faz revogacao implicita desses grants: falha fechada se existirem.
DO $postflight$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('rodizios','rodizio_itens')
    AND (
      has_table_privilege('authenticated',c.oid,'INSERT')
      OR has_table_privilege('authenticated',c.oid,'UPDATE')
      OR has_table_privilege('authenticated',c.oid,'DELETE')
      OR has_table_privilege('anonymous',c.oid,'INSERT')
      OR has_table_privilege('anonymous',c.oid,'UPDATE')
      OR has_table_privilege('anonymous',c.oid,'DELETE')
      -- Um GRANT por coluna pode sobreviver ao REVOKE de tabela.
      OR has_any_column_privilege('authenticated',c.oid,'INSERT')
      OR has_any_column_privilege('authenticated',c.oid,'UPDATE')
      OR has_any_column_privilege('anonymous',c.oid,'INSERT')
      OR has_any_column_privilege('anonymous',c.oid,'UPDATE')
    );
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'DML direto ainda acessivel, rollback'
      USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p
  WHERE p.pronamespace='public'::regnamespace AND
    p.proname='substituir_itens_rodizio_rascunho' AND
    (has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anonymous',p.oid,'EXECUTE'));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'RPC antiga ainda executavel, rollback' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p
  WHERE p.pronamespace='public'::regnamespace
    AND p.proname IN ('criar_rodizio_rascunho_versionado',
      'atualizar_cabecalho_rascunho_versionado',
      'substituir_itens_rodizio_rascunho_versionado',
      'publicar_rodizio_versionado','travar_rodizio_versionado',
      'cancelar_rodizio_versionado','excluir_rodizio_rascunho_versionado')
    AND (
      NOT p.prosecdef
      OR (p.proconfig @> ARRAY['search_path=""']::text[]) IS NOT TRUE
      OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR has_function_privilege('anonymous',p.oid,'EXECUTE')
    );
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'RPCs novas com privilegios inesperados, rollback'
      USING ERRCODE='42501';
  END IF;
END;
$postflight$;
COMMIT;

-- Apos COMMIT, manter a janela de escrita geral fechada e executar:
-- tests JWT reais, DML REST direto bloqueado, RPC antiga bloqueada,
-- revisao OCC P0001, atomicidade/rollback e estado das fixtures.
-- So reabrir apos checklist e autorizacao. NAO executar como script automatico.
