-- PROPOSTA SQL 06 — operações administrativas ainda ausentes do contrato OCC.
-- APENAS VERSIONAMENTO NO GITHUB. NÃO EXECUTAR SEM AUTORIZAÇÃO EXPRESSA.
-- Aplicar primeiro na branch Neon descartável br-holy-term-b6v6ofea,
-- após snapshot/backup e revisão técnica das decisões de negócio.
-- Segurança inicial SECURITY INVOKER: mantém RLS existente. A etapa
-- separada de redução de DML deve converter funções auditadas para
-- SECURITY DEFINER, revogar DML direto, testar JWT e só depois integrar UI.
-- Não resolve, por si só, bypass de DML e da RPC legada.
--
-- Contrato conservador: só rascunhos podem ter cabeçalho editado ou ser
-- excluídos; cancelamento permitido para rascunhos/publicados não travados
-- com versão original, preservando itens. Histórico travado imutável.

CREATE OR REPLACE FUNCTION public.criar_rodizio_rascunho_versionado(
  p_titulo text,
  p_data_inicio date,
  p_data_fim date,
  p_observacoes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF (SELECT public.usuario_atual_id()) IS NULL OR
     NOT (SELECT public.usuario_tem_perfil('admin')) THEN
    RAISE EXCEPTION 'Somente administrador autenticado pode criar rascunho'
      USING ERRCODE = '42501';
  END IF;
  IF p_titulo IS NULL OR btrim(p_titulo) = '' OR length(p_titulo) > 200
     OR p_data_inicio IS NULL OR p_data_fim IS NULL
     OR p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Titulo e intervalo de datas invalidos'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.rodizios
    (titulo, data_inicio, data_fim, observacoes, status, travado, revisao)
  VALUES (btrim(p_titulo), p_data_inicio, p_data_fim,
          p_observacoes, 'rascunho', false, 0)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_cabecalho_rascunho_versionado(
  p_rodizio_id uuid,
  p_revisao_esperada bigint,
  p_titulo text,
  p_data_inicio date,
  p_data_fim date,
  p_observacoes text
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_status text; v_travado boolean; v_revisao bigint;
BEGIN
  IF (SELECT public.usuario_atual_id()) IS NULL OR
     NOT (SELECT public.usuario_tem_perfil('admin')) THEN
    RAISE EXCEPTION 'Somente administrador autenticado pode editar rascunho'
      USING ERRCODE = '42501';
  END IF;
  IF p_rodizio_id IS NULL OR p_revisao_esperada IS NULL
     OR p_revisao_esperada < 0
     OR p_titulo IS NULL OR btrim(p_titulo) = ''
     OR length(p_titulo) > 200
     OR p_data_inicio IS NULL OR p_data_fim IS NULL
     OR p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Argumentos invalidos' USING ERRCODE = '22023';
  END IF;
  SELECT status, travado, revisao INTO v_status, v_travado, v_revisao
    FROM public.rodizios WHERE id = p_rodizio_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rascunho inexistente ou inacessivel'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_revisao IS DISTINCT FROM p_revisao_esperada THEN
    RAISE EXCEPTION 'Conflito de revisao' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'rascunho' OR v_travado THEN
    RAISE EXCEPTION 'Somente rascunhos nao travados podem ser editados'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rodizio_itens
              WHERE rodizio_id = p_rodizio_id
                AND (data < p_data_inicio OR data > p_data_fim)) THEN
    RAISE EXCEPTION 'Nova data deixaria itens fora do intervalo'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.rodizios
     SET titulo = btrim(p_titulo), data_inicio = p_data_inicio,
         data_fim = p_data_fim, observacoes = p_observacoes,
         revisao = revisao + 1
   WHERE id = p_rodizio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atualizacao recusada pela RLS' USING ERRCODE = '42501';
  END IF;
  RETURN p_revisao_esperada + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_rodizio_versionado(
  p_rodizio_id uuid,
  p_revisao_esperada bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_status text; v_travado boolean; v_revisao bigint;
BEGIN
  IF (SELECT public.usuario_atual_id()) IS NULL OR
     NOT (SELECT public.usuario_tem_perfil('admin')) THEN
    RAISE EXCEPTION 'Somente administrador autenticado pode cancelar'
      USING ERRCODE = '42501';
  END IF;
  IF p_rodizio_id IS NULL OR p_revisao_esperada IS NULL
     OR p_revisao_esperada < 0 THEN
    RAISE EXCEPTION 'Argumentos invalidos' USING ERRCODE = '22023';
  END IF;
  SELECT status, travado, revisao INTO v_status, v_travado, v_revisao
    FROM public.rodizios WHERE id = p_rodizio_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala inexistente ou inacessivel'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_revisao IS DISTINCT FROM p_revisao_esperada THEN
    RAISE EXCEPTION 'Conflito de revisao' USING ERRCODE = 'P0001';
  END IF;
  IF v_travado OR v_status NOT IN ('rascunho', 'publicado') THEN
    RAISE EXCEPTION 'Cancelamento recusado para este estado'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.rodizios
     SET status = 'cancelado', revisao = revisao + 1
   WHERE id = p_rodizio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancelamento recusado pela RLS'
      USING ERRCODE = '42501';
  END IF;
  RETURN p_revisao_esperada + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_rodizio_rascunho_versionado(
  p_rodizio_id uuid,
  p_revisao_esperada bigint
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_status text; v_travado boolean; v_revisao bigint;
BEGIN
  IF (SELECT public.usuario_atual_id()) IS NULL OR
     NOT (SELECT public.usuario_tem_perfil('admin')) THEN
    RAISE EXCEPTION 'Somente administrador autenticado pode excluir'
      USING ERRCODE = '42501';
  END IF;
  IF p_rodizio_id IS NULL OR p_revisao_esperada IS NULL
     OR p_revisao_esperada < 0 THEN
    RAISE EXCEPTION 'Argumentos invalidos' USING ERRCODE = '22023';
  END IF;
  SELECT status, travado, revisao INTO v_status, v_travado, v_revisao
    FROM public.rodizios WHERE id = p_rodizio_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rascunho inexistente ou inacessivel'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_revisao IS DISTINCT FROM p_revisao_esperada THEN
    RAISE EXCEPTION 'Conflito de revisao' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'rascunho' OR v_travado THEN
    RAISE EXCEPTION 'Somente rascunhos nao travados podem ser excluidos'
      USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.rodizios WHERE id = p_rodizio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exclusao recusada pela RLS' USING ERRCODE = '42501';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_rodizio_rascunho_versionado(text,date,date,text)
  FROM PUBLIC, anonymous;
REVOKE ALL ON FUNCTION public.atualizar_cabecalho_rascunho_versionado(uuid,bigint,text,date,date,text)
  FROM PUBLIC, anonymous;
REVOKE ALL ON FUNCTION public.cancelar_rodizio_versionado(uuid,bigint)
  FROM PUBLIC, anonymous;
REVOKE ALL ON FUNCTION public.excluir_rodizio_rascunho_versionado(uuid,bigint)
  FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.criar_rodizio_rascunho_versionado(text,date,date,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_cabecalho_rascunho_versionado(uuid,bigint,text,date,date,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_rodizio_versionado(uuid,bigint)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_rodizio_rascunho_versionado(uuid,bigint)
  TO authenticated;
