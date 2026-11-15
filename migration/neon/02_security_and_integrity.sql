create or replace function public.usuario_tem_perfil(p text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.usuarios_auxiliares where user_id=(select auth.uid()) and perfil=p) $$;

create or replace function public.usuario_tem_vinculo() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.usuarios_auxiliares where user_id=(select auth.uid())) $$;

revoke all on function public.usuario_tem_perfil(text) from public;

revoke all on function public.usuario_tem_vinculo() from public;

grant execute on function public.usuario_tem_perfil(text), public.usuario_tem_vinculo() to authenticated;

revoke all on public.auxiliares, public.restricoes_auxiliares, public.rodizios, public.rodizio_itens, public.usuarios_auxiliares from public, anonymous;

grant usage on schema public to authenticated;

grant select,insert,update,delete on public.auxiliares,public.restricoes_auxiliares,public.rodizios,public.rodizio_itens,public.usuarios_auxiliares to authenticated;

create policy auxiliares_select on public.auxiliares for select to authenticated using ( (select public.usuario_tem_perfil('admin')) or id in (select auxiliar_id from public.usuarios_auxiliares where user_id=(select auth.uid())));

create policy auxiliares_insert on public.auxiliares for insert to authenticated with check ((select public.usuario_tem_perfil('admin')));

create policy auxiliares_update on public.auxiliares for update to authenticated using ((select public.usuario_tem_perfil('admin'))) with check ((select public.usuario_tem_perfil('admin')));

create policy auxiliares_delete on public.auxiliares for delete to authenticated using ((select public.usuario_tem_perfil('admin')));

create policy restricoes_select on public.restricoes_auxiliares for select to authenticated using ((select public.usuario_tem_perfil('admin')) or (select public.usuario_tem_perfil('coordenadora')));

create policy restricoes_insert on public.restricoes_auxiliares for insert to authenticated with check ((select public.usuario_tem_perfil('admin')) or (select public.usuario_tem_perfil('coordenadora')));

create policy restricoes_update on public.restricoes_auxiliares for update to authenticated using ((select public.usuario_tem_perfil('admin')) or (select public.usuario_tem_perfil('coordenadora'))) with check ((select public.usuario_tem_perfil('admin')) or (select public.usuario_tem_perfil('coordenadora')));

create policy restricoes_delete on public.restricoes_auxiliares for delete to authenticated using ((select public.usuario_tem_perfil('admin')) or (select public.usuario_tem_perfil('coordenadora')));

create policy rodizios_select on public.rodizios for select to authenticated using ((select public.usuario_tem_perfil('admin')) or ((select public.usuario_tem_vinculo()) and status in ('publicado','travado')));

create policy rodizios_insert on public.rodizios for insert to authenticated with check ((select public.usuario_tem_perfil('admin')));

create policy rodizios_update on public.rodizios for update to authenticated using ((select public.usuario_tem_perfil('admin')) and not travado) with check ((select public.usuario_tem_perfil('admin')));

create policy rodizios_delete on public.rodizios for delete to authenticated using ((select public.usuario_tem_perfil('admin')) and status='rascunho' and not travado);

create policy rodizio_itens_select on public.rodizio_itens for select to authenticated using ((select public.usuario_tem_perfil('admin')) or ((select public.usuario_tem_vinculo()) and exists (select 1 from public.rodizios r where r.id=rodizio_id and r.status in ('publicado','travado'))));

create policy rodizio_itens_insert on public.rodizio_itens for insert to authenticated with check ((select public.usuario_tem_perfil('admin')) and exists (select 1 from public.rodizios r where r.id=rodizio_id and not r.travado));

create policy rodizio_itens_update on public.rodizio_itens for update to authenticated using ((select public.usuario_tem_perfil('admin')) and exists (select 1 from public.rodizios r where r.id=rodizio_id and not r.travado)) with check ((select public.usuario_tem_perfil('admin')) and exists (select 1 from public.rodizios r where r.id=rodizio_id and not r.travado));

create policy rodizio_itens_delete on public.rodizio_itens for delete to authenticated using ((select public.usuario_tem_perfil('admin')) and exists (select 1 from public.rodizios r where r.id=rodizio_id and not r.travado));

create policy usuarios_select on public.usuarios_auxiliares for select to authenticated using (user_id=(select auth.uid()) or (select public.usuario_tem_perfil('admin')));

create policy usuarios_insert on public.usuarios_auxiliares for insert to authenticated with check ((select public.usuario_tem_perfil('admin')));

create policy usuarios_update on public.usuarios_auxiliares for update to authenticated using ((select public.usuario_tem_perfil('admin'))) with check ((select public.usuario_tem_perfil('admin')));

create policy usuarios_delete on public.usuarios_auxiliares for delete to authenticated using ((select public.usuario_tem_perfil('admin')));

create or replace function public.bloquear_modificacao_rodizio_travado() returns trigger language plpgsql set search_path='' as $$ begin if old.travado then raise exception 'Rodízio travado não pode ser alterado'; end if; if TG_OP='DELETE' then return old; end if; return new; end $$;

create trigger trg_bloquear_rodizio_travado before update or delete on public.rodizios for each row execute function public.bloquear_modificacao_rodizio_travado();

create or replace function public.bloquear_modificacao_itens_travados() returns trigger language plpgsql set search_path='' as $$ begin if TG_OP in ('UPDATE','DELETE') then if exists(select 1 from public.rodizios where id=old.rodizio_id and travado) then raise exception 'Item de histórico travado não pode ser alterado'; end if; end if; if TG_OP in ('INSERT','UPDATE') then if exists(select 1 from public.rodizios where id=new.rodizio_id and travado) then raise exception 'Não é permitido inserir item em histórico travado'; end if; end if; if TG_OP='DELETE' then return old; end if; return new; end $$;

create trigger trg_bloquear_itens_travados before insert or update or delete on public.rodizio_itens for each row execute function public.bloquear_modificacao_itens_travados();
