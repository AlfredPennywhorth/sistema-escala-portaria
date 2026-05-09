-- ============================================================
-- SCHEMA: sistema-escala-portaria
-- Criado em: 09 de maio de 2026
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

-- Tabela: auxiliares
create table if not exists auxiliares (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  ativa boolean not null default true,
  observacoes text,
  created_at timestamptz default now()
);

-- Tabela: restricoes_auxiliares
create table if not exists restricoes_auxiliares (
  id uuid primary key default gen_random_uuid(),
  auxiliar_id uuid not null references auxiliares(id) on delete cascade,
  data date not null,
  motivo text,
  tipo text not null default 'indisponivel',
  created_at timestamptz default now()
);

-- Tabela: rodizios
create table if not exists rodizios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'travado', 'cancelado')),
  travado boolean not null default false,
  travado_em timestamptz,
  observacoes text,
  created_at timestamptz default now()
);

-- Tabela: rodizio_itens
create table if not exists rodizio_itens (
  id uuid primary key default gen_random_uuid(),
  rodizio_id uuid not null references rodizios(id) on delete cascade,
  data date not null,
  porta text not null,
  periodo text,
  auxiliar_id uuid references auxiliares(id),
  observacoes text,
  created_at timestamptz default now()
);

-- Tabela: usuarios_auxiliares
create table if not exists usuarios_auxiliares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auxiliar_id uuid references auxiliares(id) on delete set null,
  perfil text not null default 'auxiliar' check (perfil in ('admin', 'auxiliar', 'coordenadora')),
  created_at timestamptz default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index if not exists idx_rodizio_itens_rodizio_id on rodizio_itens(rodizio_id);
create index if not exists idx_rodizio_itens_auxiliar_id on rodizio_itens(auxiliar_id);
create index if not exists idx_rodizio_itens_data on rodizio_itens(data);
create index if not exists idx_restricoes_auxiliares_auxiliar_data on restricoes_auxiliares(auxiliar_id, data);
create index if not exists idx_usuarios_auxiliares_user_id on usuarios_auxiliares(user_id);
create index if not exists idx_usuarios_auxiliares_auxiliar_id on usuarios_auxiliares(auxiliar_id);
create index if not exists idx_rodizios_status on rodizios(status);
create index if not exists idx_rodizios_travado on rodizios(travado);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Função: Verifica se o usuário autenticado é admin
create or replace function is_admin()
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from usuarios_auxiliares
    where user_id = auth.uid()
      and perfil = 'admin'
  );
end;
$$;

-- Função: Verifica se o rodízio está travado
create or replace function is_rodizio_travado(p_rodizio_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from rodizios
    where id = p_rodizio_id
      and travado = true
  );
end;
$$;

-- Função: Verifica se o usuário autenticado é coordinador
create or replace function is_coordenadora()
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from usuarios_auxiliares
    where user_id = auth.uid()
      and perfil = 'coordenadora'
  );
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS em todas as tabelas
alter table auxiliares enable row level security;
alter table restricoes_auxiliares enable row level security;
alter table rodizios enable row level security;
alter table rodizio_itens enable row level security;
alter table usuarios_auxiliares enable row level security;

-- ============================================================
-- POLICIES: auxiliares
-- ============================================================

-- Admin pode fazer tudo em auxiliares
create policy "Admin pode visualizar auxiliares"
  on auxiliares for select
  using (is_admin() = true);

create policy "Admin pode inserir auxiliares"
  on auxiliares for insert
  with check (is_admin() = true);

create policy "Admin pode atualizar auxiliares"
  on auxiliares for update
  using (is_admin() = true);

create policy "Admin pode excluir auxiliares"
  on auxiliares for delete
  using (is_admin() = true);

-- ============================================================
-- POLICIES: restricoes_auxiliares
-- ============================================================

-- Admin pode fazer tudo em restrições
create policy "Admin pode visualizar restrições"
  on restricoes_auxiliares for select
  using (is_admin() = true or is_coordenadora() = true);

create policy "Admin pode inserir restrições"
  on restricoes_auxiliares for insert
  with check (is_admin() = true or is_coordenadora() = true);

create policy "Admin pode atualizar restrições"
  on restricoes_auxiliares for update
  using (is_admin() = true or is_coordenadora() = true);

create policy "Admin pode excluir restrições"
  on restricoes_auxiliares for delete
  using (is_admin() = true or is_coordenadora() = true);

-- ============================================================
-- POLICIES: rodizios
-- ============================================================

-- Admin pode fazer tudo em rodízios
create policy "Admin pode visualizar rodízios"
  on rodizios for select
  using (is_admin() = true);

create policy "Admin pode inserir rodízios"
  on rodizios for insert
  with check (is_admin() = true);

create policy "Admin pode atualizar rodízios"
  on rodizios for update
  using (
    is_admin() = true
    and (
      -- Admin pode atualizar rodízios não travados
      travado = false
      -- Para rodízios travados, apenas updates permittedidos (status) são controlados
    )
  );

create policy "Admin pode excluir rodízios rascunho"
  on rodizios for delete
  using (is_admin() = true and status = 'rascunho' and travado = false);

-- ============================================================
-- POLICIES: rodizio_itens
-- ============================================================

-- Admin pode fazer tudo em itens de rodízio
create policy "Admin pode visualizar itens de rodízio"
  on rodizio_itens for select
  using (is_admin() = true);

create policy "Admin pode inserir itens de rodízio"
  on rodizio_itens for insert
  with check (is_admin() = true);

create policy "Admin pode atualizar itens de rodízio"
  on rodizio_itens for update
  using (is_admin() = true and is_rodizio_travado(rodizio_id) = false);

create policy "Admin pode excluir itens de rodízio"
  on rodizio_itens for delete
  using (is_admin() = true and is_rodizio_travado(rodizio_id) = false);

-- ============================================================
-- POLICIES: usuarios_auxiliares
-- ============================================================

-- Usuários podem visualizar seus próprios dados
create policy "Usuários podem visualizar próprios dados"
  on usuarios_auxiliares for select
  using (user_id = auth.uid() or is_admin() = true);

-- Admin pode fazer tudo
create policy "Admin pode inserir usuários"
  on usuarios_auxiliares for insert
  with check (is_admin() = true);

create policy "Admin pode atualizar usuários"
  on usuarios_auxiliares for update
  using (is_admin() = true);

create policy "Admin pode excluir usuários"
  on usuarios_auxiliares for delete
  using (is_admin() = true);

-- ============================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================

comment on table auxiliares is 'Tabela de cadastro de auxiliares do sistema de rodízio';
comment on table restricoes_auxiliares is 'Tabela de restrições de disponibilidade das auxiliares';
comment on table rodizios is 'Tabela de cabeçalhos de rodízio';
comment on table rodizio_itens is 'Tabela de itens (escala) de cada rodízio';
comment on table usuarios_auxiliares is 'Tabela de vínculo entre usuário auth e auxiliar';

comment on function is_admin() is 'Verifica se o usuário autenticado possui perfil admin';
comment on function is_rodizio_travado is 'Verifica se um rodízio específico está travado';
comment on function is_coordenadora() is 'Verifica se o usuário autenticado possui perfil coordenadora';

-- ============================================================
-- PROTEÇÃO DE TRAVAMENTO (TRIGGERS)
-- ============================================================

-- Função para prevenir alterações em rodízios travados
create or replace function proteger_rodizio_travado()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Verifica se o rodízio está travado
  if exists (
    select 1 from rodizios
    where id = coalesce(NEW.id, OLD.id)
      and travado = true
  ) then
    raise exception 'Rodízio travado não pode ser alterado. Use-o como histórico para equilíbrio das próximas escalas.';
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- Trigger para UPDATE em rodizios
drop trigger if exists trg_proteger_rodizio_travado_update on rodizios;
create trigger trg_proteger_rodizio_travado_update
  before update on rodizios
  for each row
  execute function proteger_rodizio_travado();

-- Trigger para DELETE em rodizios
drop trigger if exists trg_proteger_rodizio_travado_delete on rodizios;
create trigger trg_proteger_rodizio_travado_delete
  before delete on rodizios
  for each row
  execute function proteger_rodizio_travado();

-- Função para prevenir alterações em itens de rodízio travado
create or replace function proteger_itens_rodizio_travado()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Verifica se o rodízio pai está travado
  if exists (
    select 1 from rodizios r
    join rodizio_itens ri on ri.rodizio_id = r.id
    where ri.id = coalesce(NEW.id, OLD.id)
      and r.travado = true
  ) then
    raise exception 'Itens de rodízio travado não podem ser alterados.';
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- Trigger para UPDATE em rodizio_itens
drop trigger if exists trg_proteger_itens_rodizio_travado_update on rodizio_itens;
create trigger trg_proteger_itens_rodizio_travado_update
  before update on rodizio_itens
  for each row
  execute function proteger_itens_rodizio_travado();

-- Trigger para DELETE em rodizio_itens
drop trigger if exists trg_proteger_itens_rodizio_travado_delete on rodizio_itens;
create trigger trg_proteger_itens_rodizio_travado_delete
  before delete on rodizio_itens
  for each row
  execute function proteger_itens_rodizio_travado();

comment on function proteger_rodizio_travado() is 'Impede UPDATE e DELETE em rodízios travados';
comment on function proteger_itens_rodizio_travado() is 'Impede UPDATE e DELETE em itens de rodízio travado';