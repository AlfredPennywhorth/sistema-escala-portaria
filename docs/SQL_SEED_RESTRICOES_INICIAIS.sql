-- ============================================================
-- SEED: Restrições Iniciais das Auxiliares
-- Data: 09 de maio de 2026
-- Descrição: Insere restrições conhecidas das auxiliares
-- Executar no SQL Editor do Supabase
-- ============================================================

-- Bruna Gasque não atende Terça-feira (dia_semana = 2)
INSERT INTO restricoes_auxiliares (auxiliar_id, dia_semana, tipo, motivo, ativa)
SELECT id, 2, 'indisponivel', 'Não atende Terça-feira', true
FROM auxiliares
WHERE nome ILIKE '%Bruna Gasque%'
ON CONFLICT DO NOTHING;

-- Bruna Gasque não atende Sanitário
INSERT INTO restricoes_auxiliares (auxiliar_id, porta, tipo, motivo, ativa)
SELECT id, 'Sanitário', 'indisponivel', 'Não atende Sanitário', true
FROM auxiliares
WHERE nome ILIKE '%Bruna Gasque%'
ON CONFLICT DO NOTHING;

-- Lourdes não atende Sanitário
INSERT INTO restricoes_auxiliares (auxiliar_id, porta, tipo, motivo, ativa)
SELECT id, 'Sanitário', 'indisponivel', 'Não atende Sanitário', true
FROM auxiliares
WHERE nome ILIKE '%Lourdes%'
ON CONFLICT DO NOTHING;

-- Maria (Manoel) não atende Galeria
INSERT INTO restricoes_auxiliares (auxiliar_id, porta, tipo, motivo, ativa)
SELECT id, 'Galeria', 'indisponivel', 'Não atende Galeria', true
FROM auxiliares
WHERE nome ILIKE '%Maria%Manoel%' OR nome ILIKE '%Manoel%Maria%'
ON CONFLICT DO NOTHING;

-- Maria (Manoel) não atende Sanitário
INSERT INTO restricoes_auxiliares (auxiliar_id, porta, tipo, motivo, ativa)
SELECT id, 'Sanitário', 'indisponivel', 'Não atende Sanitário', true
FROM auxiliares
WHERE nome ILIKE '%Maria%Manoel%' OR nome ILIKE '%Manoel%Maria%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

-- Verificar restrições inseridas
SELECT 
  a.nome as auxiliar,
  CASE 
    WHEN r.dia_semana IS NOT NULL THEN 'Dia ' || r.dia_semana || ' (' || CASE r.dia_semana 
      WHEN 0 THEN 'Domingo'
      WHEN 1 THEN 'Segunda'
      WHEN 2 THEN 'Terça'
      WHEN 3 THEN 'Quarta'
      WHEN 4 THEN 'Quinta'
      WHEN 5 THEN 'Sexta'
      WHEN 6 THEN 'Sábado'
    END || ')'
    ELSE COALESCE('Porta: ' || r.porta, 'Data: ' || r.data::text)
  END as restricao,
  r.tipo,
  r.motivo
FROM restricoes_auxiliares r
JOIN auxiliares a ON r.auxiliar_id = a.id
WHERE r.ativa = true
ORDER BY a.nome, r.tipo;