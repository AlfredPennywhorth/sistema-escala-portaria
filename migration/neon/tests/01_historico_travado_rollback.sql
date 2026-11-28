-- Homologação de gatilhos de integridade: executar SOMENTE na branch Neon isolada.
-- Dados inteiramente sintéticos; transação revertida inclusive em caso de sucesso.
BEGIN;

DO $$
DECLARE
  v_aux uuid := 'f0000000-0000-4000-8000-000000000101';
  v_draft uuid := 'f0000000-0000-4000-8000-000000000102';
  v_locked uuid := 'f0000000-0000-4000-8000-000000000103';
  v_item uuid;
  rejected boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.auxiliares WHERE id=v_aux)
     OR EXISTS (SELECT 1 FROM public.rodizios WHERE id IN (v_draft,v_locked)) THEN
    RAISE EXCEPTION 'IDs de fixture ocupados: interrompendo';
  END IF;

  INSERT INTO public.auxiliares(id,nome) VALUES(v_aux,'TESTE AUTOMATICO FICTICIO');
  INSERT INTO public.rodizios(id,titulo,data_inicio,data_fim,status,travado)
  VALUES (v_draft,'TESTE RASCUNHO','2026-12-01','2026-12-31','rascunho',false);
  INSERT INTO public.rodizios(id,titulo,data_inicio,data_fim,status,travado)
  VALUES (v_locked,'TESTE TRAVADO','2026-12-01','2026-12-31','publicado',false);

  INSERT INTO public.rodizio_itens(rodizio_id,data,porta,auxiliar_id)
  VALUES (v_locked,'2026-12-02','Entrada',v_aux) RETURNING id INTO v_item;

  UPDATE public.rodizios SET travado=true,status='travado' WHERE id=v_locked;

  rejected := false;
  BEGIN
    UPDATE public.rodizios SET titulo='INDEVIDO' WHERE id=v_locked;
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Falhou: UPDATE de rodizio travado permitido'; END IF;

  rejected := false;
  BEGIN
    DELETE FROM public.rodizios WHERE id=v_locked;
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Falhou: DELETE de rodizio travado permitido'; END IF;

  rejected := false;
  BEGIN
    INSERT INTO public.rodizio_itens(rodizio_id,data,porta) VALUES(v_locked,'2026-12-03','Galeria');
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Falhou: INSERT no rodizio travado permitido'; END IF;

  rejected := false;
  BEGIN
    UPDATE public.rodizio_itens SET porta='Galeria' WHERE id=v_item;
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Falhou: UPDATE de item travado permitido'; END IF;

  rejected := false;
  BEGIN
    DELETE FROM public.rodizio_itens WHERE id=v_item;
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Falhou: DELETE de item travado permitido'; END IF;

  rejected := false;
  BEGIN
    UPDATE public.rodizio_itens SET rodizio_id=v_draft WHERE id=v_item;
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Falhou: movimentacao de item travado permitida'; END IF;
END $$;

ROLLBACK;
