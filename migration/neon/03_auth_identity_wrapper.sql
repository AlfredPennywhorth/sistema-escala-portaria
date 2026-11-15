create or replace function public.usuario_atual_id() returns uuid language sql stable security definer set search_path='' as $$ select auth.uid() $$;

revoke all on function public.usuario_atual_id() from public;

grant execute on function public.usuario_atual_id() to authenticated;

alter policy auxiliares_select on public.auxiliares using ((select public.usuario_tem_perfil('admin')) or id in (select auxiliar_id from public.usuarios_auxiliares where user_id=(select public.usuario_atual_id())));

alter policy usuarios_select on public.usuarios_auxiliares using (user_id=(select public.usuario_atual_id()) or (select public.usuario_tem_perfil('admin')));
