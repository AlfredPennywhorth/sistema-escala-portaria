-- ============================================================
-- SQL SEED: auxiliares iniciais
-- Sistema de Escala de Portaria
-- Executar no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- ATENÇÃO: Execute este script APÓS aplicar schema.sql
-- ============================================================

-- ============================================================
-- 1. Inserir Auxiliares Iniciais
-- ============================================================

insert into auxiliares (nome, telefone, email, ativa, observacoes)
values 
  ('Bruna Diego', null, null, true, null),
  ('Bruna Gasque', null, null, true, 'Restrição: Terça-Feira'),
  ('Dalete', null, null, true, null),
  ('Josefa', null, null, true, null),
  ('Lourdes', null, null, true, 'Restrição: Sanitário'),
  ('Maria (Manoel)', null, null, true, 'Restrição: Galeria, Sanitário'),
  ('Maria (Severino)', null, null, true, null),
  ('Nelida', null, null, true, null),
  ('Sueli', null, null, true, null);

-- ============================================================
-- 2. Verificar inserção
-- ============================================================

-- Selecionar todas as auxiliares para verificar
select id, nome, telefone, email, ativa from auxiliares order by nome;

-- Contagem deve ser 9
select count(*) as total_auxiliares from auxiliares;

-- ============================================================
-- 3. Exemplo: Criar restrições (opcional)
-- ============================================================

-- Bruna Gasque não escala na Terça-Feira
insert into restricoes_auxiliares (auxiliar_id, data, tipo, motivo)
select 
  id,
  null, -- data específica é null para restrições recorrentes
  'indisponivel',
  'Não escala às terças'
from auxiliares 
where nome = 'Bruna Gasque';

-- ============================================================
-- 4. Vincular Admin (se ainda não fez)
-- ============================================================

-- Primeiro, obtenha o ID do seu usuário no Supabase Auth:
-- Supabase Dashboard → Authentication → Users → copie o ID

-- Depois, execute (substitua YOUR_USER_ID):
/*
insert into usuarios_auxiliares (user_id, perfil)
values ('YOUR_USER_ID', 'admin');
*/

-- ============================================================
-- 5. Verificar tudo
-- ============================================================

-- Verificar auxiliares
select * from auxiliares;

-- Verificar restrições
select * from restricoes_auxiliares;

-- Verificar usuários
select * from usuarios_auxiliares;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================