-- PROPOSTA DE VERSIONAMENTO, NÃO APLICAR SEM NOVO GATE.
-- Branch de homologação descartável primeiro; NUNCA produção diretamente.
-- Pré-requisito: impedir todos os demais caminhos de editar itens,
-- publicar ou travar sem checagem de revision (inclusive DML direto).
-- Esta proposta isolada NÃO fecha esse gate sistêmico.
--
-- Revisão inicial = 0 para todas as escalas existentes. Aplicar lock de
-- manutenção durante rollout e registrar a revisão no GET inicial do editor.
-- A versão esperada deve ser aquela vista ao ABRIR o editor, não refetch
-- imediatamente antes do POST, para não esconder conflitos.
ALTER TABLE public.rodizios
  ADD COLUMN IF NOT EXISTS revisao bigint NOT NULL DEFAULT 0;

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
  if v_travado or v_status <> 'rascunho' then
    raise exception 'Substituicao permitida somente em escala em rascunho nao travada'
      using errcode = '42501';
  end if;

  -- Checagem OCC feita sob o MESMO row lock; outro cliente que abriu
  -- revisao anterior recebe conflito, sem apagar nenhum item.
  if v_revisao_atual is distinct from p_revisao_esperada then
    raise exception 'Conflito de revisao. Atual %, esperada %', v_revisao_atual, p_revisao_esperada
      using errcode = 'P0001';
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

REVOKE ALL ON FUNCTION public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint)
  FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint)
  TO authenticated;

-- IMPORTANTE: a versão ANTIGA da RPC segue utilizável se não for revogada.
-- Após homologar TODAS as telas, cortar privilégios da função antiga numa
-- migração específica e migrar transições publicar/travar para OCC transacional.
-- O rascunho atual permite execução administrativa direta em rodizio_itens:
-- não declarar ausência de lost update até que TODOS os write-paths estejam
-- com guard no banco. Evitar trigger que cause dupla revisão na mesma RPC.
