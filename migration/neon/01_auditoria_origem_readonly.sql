-- AUDITORIA SOMENTE LEITURA — executar no Supabase SQL Editor, quando reativado.
-- Não traz nomes, telefones, e-mails, senhas ou tokens em resultados.
-- Não altera schema nem dados. Execute cada bloco separadamente, se necessário.

-- 1. Inventário de colunas das cinco tabelas de negócio
select table_schema, table_name, ordinal_position, column_name, data_type,
       udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('auxiliares','restricoes_auxiliares','rodizios','rodizio_itens','usuarios_auxiliares')
order by table_name, ordinal_position;

-- 2. Contagem de registros por tabela (sem PII)
select 'auxiliares' as tabela, count(*) as total from public.auxiliares
union all select 'restricoes_auxiliares', count(*) from public.restricoes_auxiliares
union all select 'rodizios', count(*) from public.rodizios
union all select 'rodizio_itens', count(*) from public.rodizio_itens
union all select 'usuarios_auxiliares', count(*) from public.usuarios_auxiliares;

-- 3. Contagem por perfil e situação das escalas
select perfil, count(*) as total from public.usuarios_auxiliares group by perfil order by perfil;
select status, travado, count(*) as total from public.rodizios
group by status, travado order by status, travado;

-- 4. Vínculos órfãos e duplicação de vínculo de usuário
select count(*) as vinculos_sem_conta_auth
from public.usuarios_auxiliares ua left join auth.users au on au.id = ua.user_id
where au.id is null;
select count(*) as vinculos_sem_auxiliar
from public.usuarios_auxiliares ua left join public.auxiliares a on a.id = ua.auxiliar_id
where ua.auxiliar_id is not null and a.id is null;
select count(*) as usuarios_com_multiplos_vinculos
from (select user_id from public.usuarios_auxiliares group by user_id having count(*) > 1) x;
select count(*) as itens_sem_rodizio
from public.rodizio_itens ri left join public.rodizios r on r.id = ri.rodizio_id
where r.id is null;

-- 5. Resumo de usuários (sem identificadores nem e-mails)
select count(*) as usuarios_auth from auth.users;
select count(*) as usuarios_com_email_confirmado from auth.users where email_confirmed_at is not null;

-- 6. Policies RLS e estado de proteção
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
and tablename in ('auxiliares','restricoes_auxiliares','rodizios','rodizio_itens','usuarios_auxiliares')
order by tablename, policyname;
select relname as tabela, relrowsecurity as rls_habilitado, relforcerowsecurity as rls_forcado
from pg_class where relnamespace = 'public'::regnamespace
and relname in ('auxiliares','restricoes_auxiliares','rodizios','rodizio_itens','usuarios_auxiliares')
order by relname;

-- 7. FKs e constraints, incluindo restrições recorrentes
select conrelid::regclass::text as tabela, conname, contype,
       pg_get_constraintdef(oid) as definicao
from pg_constraint where connamespace = 'public'::regnamespace
and conrelid::regclass::text in ('auxiliares','restricoes_auxiliares','rodizios','rodizio_itens','usuarios_auxiliares')
order by tabela, conname;

-- 8. Gatilhos não internos e funções públicas relevantes
select event_object_table as tabela, trigger_name, action_timing, event_manipulation,
       action_statement from information_schema.triggers
where trigger_schema = 'public' and event_object_table in
('auxiliares','restricoes_auxiliares','rodizios','rodizio_itens','usuarios_auxiliares')
order by tabela, trigger_name;
select proname as funcao, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in
('is_admin','is_coordenadora','is_rodizio_travado','proteger_rodizio_travado','proteger_itens_rodizio_travado')
order by proname;

-- 9. Índices
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'
and tablename in ('auxiliares','restricoes_auxiliares','rodizios','rodizio_itens','usuarios_auxiliares')
order by tablename, indexname;
