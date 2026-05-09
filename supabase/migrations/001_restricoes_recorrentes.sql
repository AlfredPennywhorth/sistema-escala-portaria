-- ============================================================
-- MIGRATION: 001_restricoes_recorrentes
-- Data: 09 de maio de 2026
-- Descrição: Adiciona campos para restrições recorrentes (dia da semana e porta)
-- ============================================================

-- Adicionar coluna dia_semana (0-6, onde 0=Domingo)
ALTER TABLE restricoes_auxiliares 
ADD COLUMN IF NOT EXISTS dia_semana integer;

COMMENT ON COLUMN restricoes_auxiliares.dia_semana IS 
'Dia da semana da restrição recorrente (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado). Null para restrições por data específica.';

-- Adicionar coluna porta (local/restrição por local)
ALTER TABLE restricoes_auxiliares 
ADD COLUMN IF NOT EXISTS porta text;

COMMENT ON COLUMN restricoes_auxiliares.porta IS 
'Porta/local da restrição. Valores válidos: Entrada, Galeria, Lateral, Sanitário. Null para restrições sem local específico.';

-- Adicionar coluna ativa (soft delete)
ALTER TABLE restricoes_auxiliares 
ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN restricoes_auxiliares.ativa IS 
'Indica se a restrição está ativa. False = restrição desativada mas não excluída.';

-- Adicionar constraint para dia_semana válido (0-6)
ALTER TABLE restricoes_auxiliares 
ADD CONSTRAINT IF NOT EXISTS chk_dia_semana_valido 
CHECK (dia_semana IS NULL OR (dia_semana >= 0 AND dia_semana <= 6));

-- Adicionar constraint para tipos válidos
ALTER TABLE restricoes_auxiliares 
ADD CONSTRAINT IF NOT EXISTS chk_tipo_valido 
CHECK (tipo IN ('indisponivel', 'preferencia', 'evitar', 'observacao'));

-- Criar índice para consultas por dia da semana
CREATE INDEX IF NOT EXISTS idx_restricoes_dia_semana 
ON restricoes_auxiliares(dia_semana) 
WHERE dia_semana IS NOT NULL;

-- Criar índice para consultas por porta
CREATE INDEX IF NOT EXISTS idx_restricoes_porta 
ON restricoes_auxiliares(porta) 
WHERE porta IS NOT NULL;

-- Criar índice para restrições ativas
CREATE INDEX IF NOT EXISTS idx_restricoes_ativa 
ON restricoes_auxiliares(ativa) 
WHERE ativa = true;

-- Atualizar constraint da coluna data para ser nullable
-- Uma restrição pode ser por dia_semana OU por data, não necessariamente ambos
ALTER TABLE restricoes_auxiliares 
ALTER COLUMN data DROP NOT NULL;

COMMENT ON COLUMN restricoes_auxiliares.data IS 
'Data específica da restrição. Null para restrições recorrentes (usar dia_semana).';

-- ============================================================
-- COMENTÁRIOS ADICIONAIS
-- ============================================================

COMMENT ON COLUMN restricoes_auxiliares.tipo IS 
'Tipo de restrição: indisponivel (bloqueio absoluto), preferencia (bônus), evitar (penalidade), observacao (apenas informativo).';

COMMENT ON COLUMN restricoes_auxiliares.motivo IS 
'Motivação ou descrição da restrição. Ex: "Não trabalha Terça-feira", "Não atende Sanitário".';

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

DO $$
BEGIN
  -- Verificar se as colunas foram adicionadas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restricoes_auxiliares' AND column_name = 'dia_semana'
  ) THEN
    RAISE NOTICE 'Coluna dia_semana não foi criada. Verifique manualmente.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restricoes_auxiliares' AND column_name = 'porta'
  ) THEN
    RAISE NOTICE 'Coluna porta não foi criada. Verifique manualmente.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restricoes_auxiliares' AND column_name = 'ativa'
  ) THEN
    RAISE NOTICE 'Coluna ativa não foi criada. Verifique manualmente.';
  END IF;
  
  RAISE NOTICE 'Migration 001_restricoes_recorrentes executada com sucesso.';
END $$;