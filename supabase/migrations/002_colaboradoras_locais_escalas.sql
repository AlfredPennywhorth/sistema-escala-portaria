-- MIGRATION: 002_colaboradoras_locais_escalas
-- Tabelas usadas pelo store Zustand (src/store/useStore.ts)

create table if not exists colaboradoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  restricoes jsonb not null default '{}'::jsonb,
  carga_acumulada integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz default now()
);

create table if not exists escalas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  local_id uuid not null references locais(id) on delete cascade,
  colaboradora_id uuid not null references colaboradoras(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_escalas_data on escalas(data);

alter table colaboradoras enable row level security;
alter table locais enable row level security;
alter table escalas enable row level security;

create policy "Autenticados leem colaboradoras" on colaboradoras for select using (auth.uid() is not null);
create policy "Admin escreve colaboradoras" on colaboradoras for all using (is_admin() = true) with check (is_admin() = true);
create policy "Autenticados leem locais" on locais for select using (auth.uid() is not null);
create policy "Admin escreve locais" on locais for all using (is_admin() = true) with check (is_admin() = true);
create policy "Autenticados leem escalas" on escalas for select using (auth.uid() is not null);
create policy "Admin escreve escalas" on escalas for all using (is_admin() = true) with check (is_admin() = true);

-- Dados iniciais
insert into locais (nome) values ('Entrada'), ('Galeria'), ('Lateral'), ('Sanitário') on conflict (nome) do nothing;
insert into colaboradoras (nome, restricoes)
select v.nome, v.restricoes::jsonb from (values
  ('Bruna Diego', '{}'),
  ('Bruna Gasque', '{"dia":["Terça-Feira"]}'),
  ('Dalete', '{}'),
  ('Josefa', '{}'),
  ('Lourdes', '{"local":["Sanitário"]}'),
  ('Maria (Manoel)', '{"local":["Galeria","Sanitário"]}'),
  ('Maria (Severino)', '{}'),
  ('Nelida', '{}'),
  ('Sueli', '{}')
) as v(nome, restricoes)
where not exists (select 1 from colaboradoras);
