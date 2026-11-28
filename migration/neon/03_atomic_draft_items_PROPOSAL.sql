-- PROPOSTA, NAO APLICAR AUTOMATICAMENTE.
-- Somente branch HML apos revisao tecnica e gate explicito.
-- Substituicao integral de itens somente em RASCUNHO.
-- A chamada RPC do PostgREST roda em uma unica transacao: erro em qualquer
-- item desfaz o DELETE e TODOS os INSERTs (sem exclusao parcial).
--
-- A funcao e SECURITY INVOKER; nunca elevar privilegios de usuario.
-- A identidade vem de public.usuario_atual_id(), wrapper DEFINER ja existente:
-- authenticated nao possui USAGE no schema auth no ambiente Neon.
-- Polices RLS nas duas tabelas e triggers permanecem ativos.

create or replace function public.substituir_itens_rodizio_rascunho(
  p_rodizio_id uuid,
  p_itens jsonb
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
begin
  if (select public.usuario_atual_id()) is null or
     not (select public.usuario_tem_perfil('admin')) then
    raise exception 'Somente administrador autenticado pode gravar itens'
      using errcode = '42501';
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
  select r.status, r.travado, r.data_inicio, r.data_fim
    into v_status, v_travado, v_inicio, v_fim
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

  return v_total;
end;
$$;

-- Impede acesso a PUBLIC/anonymous. O invoker ainda precisa das
-- permissoes e policies RLS existentes, nao bastando o GRANT EXECUTE.
revoke all on function public.substituir_itens_rodizio_rascunho(uuid,jsonb)
  from public, anonymous;
grant execute on function public.substituir_itens_rodizio_rascunho(uuid,jsonb)
  to authenticated;
