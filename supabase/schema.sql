-- Schema inicial Supabase para o sistema de escala de portaria.
-- Execute este arquivo no SQL Editor do Supabase ou via Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.auxiliares (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  ativa boolean not null default true,
  observacoes text,
  created_at timestamptz default now()
);

create table if not exists public.restricoes_auxiliares (
  id uuid primary key default gen_random_uuid(),
  auxiliar_id uuid not null references public.auxiliares(id) on delete cascade,
  data date not null,
  motivo text,
  tipo text not null default 'indisponivel',
  created_at timestamptz default now()
);

create table if not exists public.rodizios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'rascunho',
  travado boolean not null default false,
  travado_em timestamptz,
  observacoes text,
  created_at timestamptz default now(),
  constraint rodizios_status_check check (status in ('rascunho', 'publicado', 'travado')),
  constraint rodizios_datas_check check (data_inicio <= data_fim),
  constraint rodizios_travado_status_check check ((travado = false) or (status = 'travado'))
);

create table if not exists public.rodizio_itens (
  id uuid primary key default gen_random_uuid(),
  rodizio_id uuid not null references public.rodizios(id) on delete cascade,
  data date not null,
  porta text not null,
  periodo text,
  auxiliar_id uuid references public.auxiliares(id),
  observacoes text,
  created_at timestamptz default now()
);

create table if not exists public.usuarios_auxiliares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auxiliar_id uuid references public.auxiliares(id) on delete set null,
  perfil text not null default 'auxiliar',
  created_at timestamptz default now(),
  constraint usuarios_auxiliares_perfil_check check (perfil in ('admin', 'auxiliar')),
  constraint usuarios_auxiliares_user_id_unique unique (user_id)
);

create index if not exists rodizio_itens_rodizio_id_idx on public.rodizio_itens(rodizio_id);
create index if not exists rodizio_itens_auxiliar_id_idx on public.rodizio_itens(auxiliar_id);
create index if not exists restricoes_auxiliares_auxiliar_id_data_idx on public.restricoes_auxiliares(auxiliar_id, data);
create index if not exists usuarios_auxiliares_user_id_idx on public.usuarios_auxiliares(user_id);
create index if not exists usuarios_auxiliares_auxiliar_id_idx on public.usuarios_auxiliares(auxiliar_id);

alter table public.auxiliares enable row level security;
alter table public.restricoes_auxiliares enable row level security;
alter table public.rodizios enable row level security;
alter table public.rodizio_itens enable row level security;
alter table public.usuarios_auxiliares enable row level security;

create or replace function public.usuario_atual_e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_auxiliares ua
    where ua.user_id = auth.uid()
      and ua.perfil = 'admin'
  );
$$;

create or replace function public.auxiliar_id_do_usuario_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ua.auxiliar_id
  from public.usuarios_auxiliares ua
  where ua.user_id = auth.uid()
  limit 1;
$$;

-- AUXILIARES
create policy "admin pode visualizar auxiliares"
  on public.auxiliares for select
  using (public.usuario_atual_e_admin());

create policy "admin pode inserir auxiliares"
  on public.auxiliares for insert
  with check (public.usuario_atual_e_admin());

create policy "admin pode atualizar auxiliares"
  on public.auxiliares for update
  using (public.usuario_atual_e_admin())
  with check (public.usuario_atual_e_admin());

create policy "admin pode excluir auxiliares"
  on public.auxiliares for delete
  using (public.usuario_atual_e_admin());

create policy "auxiliar pode visualizar seus proprios dados"
  on public.auxiliares for select
  using (id = public.auxiliar_id_do_usuario_atual());

-- RESTRICOES
create policy "admin pode visualizar restricoes"
  on public.restricoes_auxiliares for select
  using (public.usuario_atual_e_admin());

create policy "admin pode inserir restricoes"
  on public.restricoes_auxiliares for insert
  with check (public.usuario_atual_e_admin());

create policy "admin pode atualizar restricoes"
  on public.restricoes_auxiliares for update
  using (public.usuario_atual_e_admin())
  with check (public.usuario_atual_e_admin());

create policy "admin pode excluir restricoes"
  on public.restricoes_auxiliares for delete
  using (public.usuario_atual_e_admin());

create policy "auxiliar pode visualizar suas restricoes"
  on public.restricoes_auxiliares for select
  using (auxiliar_id = public.auxiliar_id_do_usuario_atual());

-- RODIZIOS
create policy "admin pode visualizar rodizios"
  on public.rodizios for select
  using (public.usuario_atual_e_admin());

create policy "admin pode inserir rodizios"
  on public.rodizios for insert
  with check (public.usuario_atual_e_admin());

create policy "admin pode atualizar rodizios nao travados"
  on public.rodizios for update
  using (public.usuario_atual_e_admin() and travado = false)
  with check (public.usuario_atual_e_admin());

create policy "admin pode excluir rodizios nao travados"
  on public.rodizios for delete
  using (public.usuario_atual_e_admin() and travado = false);

create policy "auxiliar pode visualizar rodizios publicados ou travados"
  on public.rodizios for select
  using (status in ('publicado', 'travado') or travado = true);

-- RODIZIO ITENS
create policy "admin pode visualizar itens de rodizio"
  on public.rodizio_itens for select
  using (public.usuario_atual_e_admin());

create policy "admin pode inserir itens em rodizios nao travados"
  on public.rodizio_itens for insert
  with check (
    public.usuario_atual_e_admin()
    and exists (
      select 1
      from public.rodizios r
      where r.id = rodizio_id
        and r.travado = false
    )
  );

create policy "admin pode atualizar itens de rodizios nao travados"
  on public.rodizio_itens for update
  using (
    public.usuario_atual_e_admin()
    and exists (
      select 1
      from public.rodizios r
      where r.id = rodizio_id
        and r.travado = false
    )
  )
  with check (
    public.usuario_atual_e_admin()
    and exists (
      select 1
      from public.rodizios r
      where r.id = rodizio_id
        and r.travado = false
    )
  );

create policy "admin pode excluir itens de rodizios nao travados"
  on public.rodizio_itens for delete
  using (
    public.usuario_atual_e_admin()
    and exists (
      select 1
      from public.rodizios r
      where r.id = rodizio_id
        and r.travado = false
    )
  );

create policy "auxiliar pode visualizar itens publicados ou travados"
  on public.rodizio_itens for select
  using (
    exists (
      select 1
      from public.rodizios r
      where r.id = rodizio_id
        and (r.status in ('publicado', 'travado') or r.travado = true)
    )
  );

-- USUARIOS AUXILIARES
create policy "admin pode visualizar usuarios auxiliares"
  on public.usuarios_auxiliares for select
  using (public.usuario_atual_e_admin());

create policy "admin pode inserir usuarios auxiliares"
  on public.usuarios_auxiliares for insert
  with check (public.usuario_atual_e_admin());

create policy "admin pode atualizar usuarios auxiliares"
  on public.usuarios_auxiliares for update
  using (public.usuario_atual_e_admin())
  with check (public.usuario_atual_e_admin());

create policy "admin pode excluir usuarios auxiliares"
  on public.usuarios_auxiliares for delete
  using (public.usuario_atual_e_admin());

create policy "auxiliar pode visualizar seu proprio vinculo"
  on public.usuarios_auxiliares for select
  using (user_id = auth.uid());
