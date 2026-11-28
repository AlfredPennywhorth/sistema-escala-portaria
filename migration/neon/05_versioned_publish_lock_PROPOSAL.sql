-- PROPOSTA 05: transições de estado com revisão otimista (OCC)
-- NÃO APLICAR EM PRODUÇÃO OU NA HML PRINCIPAL.
-- Depende de migration/neon/04_optimistic_revision_drafts_PROPOSAL.sql.
-- Não fecha os caminhos DML diretos, a RPC 03 legada ou a inserção histórica.
-- Antes da implantação geral é obrigatório controlar esses bypasses.
--
-- A RPC mantém SECURITY INVOKER e as policies RLS já existentes.
-- O SELECT FOR UPDATE serializa mudanças sobre a mesma escala, e a revisão
-- capturada na abertura da tela é comparada ANTES da alteração.
--
-- Decisão conservadora: publicar apenas rascunho não travado; travar apenas
-- publicado não travado com pelo menos um item. Não reabrir nem alterar
-- o histórico travado por esta via.

CREATE OR REPLACE FUNCTION public.publicar_rodizio_versionado(
  p_rodizio_id uuid,
  p_revisao_esperada bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_travado boolean;
  v_revisao bigint;
BEGIN
  IF (SELECT public.usuario_atual_id()) IS NULL OR
     NOT (SELECT public.usuario_tem_perfil('admin')) THEN
    RAISE EXCEPTION 'Somente administrador autenticado pode publicar'
      USING ERRCODE = '42501';
  END IF;
  IF p_rodizio_id IS NULL OR p_revisao_esperada IS NULL
     OR p_revisao_esperada < 0 THEN
    RAISE EXCEPTION 'ID e revisao esperada sao obrigatorios'
      USING ERRCODE = '22023';
  END IF;

  SELECT r.status, r.travado, r.revisao
    INTO v_status, v_travado, v_revisao
    FROM public.rodizios AS r
   WHERE r.id = p_rodizio_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala inexistente ou inacessivel'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_revisao IS DISTINCT FROM p_revisao_esperada THEN
    RAISE EXCEPTION 'Conflito de revisao ao publicar'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'rascunho' OR v_travado THEN
    RAISE EXCEPTION 'Publicacao exige rascunho nao travado'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.rodizio_itens
    WHERE rodizio_id = p_rodizio_id
  ) THEN
    RAISE EXCEPTION 'Publicacao exige ao menos um item'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.rodizios
     SET status = 'publicado', revisao = revisao + 1
   WHERE id = p_rodizio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala nao atualizada pela RLS'
      USING ERRCODE = '42501';
  END IF;
  RETURN p_revisao_esperada + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.travar_rodizio_versionado(
  p_rodizio_id uuid,
  p_revisao_esperada bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_travado boolean;
  v_revisao bigint;
BEGIN
  IF (SELECT public.usuario_atual_id()) IS NULL OR
     NOT (SELECT public.usuario_tem_perfil('admin')) THEN
    RAISE EXCEPTION 'Somente administrador autenticado pode travar'
      USING ERRCODE = '42501';
  END IF;
  IF p_rodizio_id IS NULL OR p_revisao_esperada IS NULL
     OR p_revisao_esperada < 0 THEN
    RAISE EXCEPTION 'ID e revisao esperada sao obrigatorios'
      USING ERRCODE = '22023';
  END IF;

  SELECT r.status, r.travado, r.revisao
    INTO v_status, v_travado, v_revisao
    FROM public.rodizios AS r
   WHERE r.id = p_rodizio_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala inexistente ou inacessivel'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_revisao IS DISTINCT FROM p_revisao_esperada THEN
    RAISE EXCEPTION 'Conflito de revisao ao travar'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'publicado' OR v_travado THEN
    RAISE EXCEPTION 'Travamento exige escala publicada nao travada'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.rodizio_itens
    WHERE rodizio_id = p_rodizio_id
  ) THEN
    RAISE EXCEPTION 'Nao e permitido travar escala sem itens'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.rodizios
     SET status = 'travado', travado = true, travado_em = now(),
         revisao = revisao + 1
   WHERE id = p_rodizio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala nao atualizada pela RLS'
      USING ERRCODE = '42501';
  END IF;
  RETURN p_revisao_esperada + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.publicar_rodizio_versionado(uuid,bigint)
  FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.publicar_rodizio_versionado(uuid,bigint)
  TO authenticated;

REVOKE ALL ON FUNCTION public.travar_rodizio_versionado(uuid,bigint)
  FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.travar_rodizio_versionado(uuid,bigint)
  TO authenticated;

-- PENDENTE: migração coordenada para retirada dos DML diretos, controle
-- de cancelamento/edição/exclusão, desativação da RPC não versionada, teste
-- concorrente real e validação de JWT/segurança na branch descartável.
