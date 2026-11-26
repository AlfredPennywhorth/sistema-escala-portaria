/**
 * Serviço agregador para operações de edição de rodízios via Neon.
 * Integra os 7 adaptadores versão SQL 06 com tratamento de conflitos OCC,
 * erros de autorização e respostas indeterminadas.
 *
 * Preserva a revisão original capturada na abertura do editor.
 * Não atualiza silenciosamente a revisão para contornar conflitos.
 * Separa alterações de cabeçalho e itens (transações distintas).
 */

import type { ServiceResult, RodizioItemInput } from '../../types/supabase';
import {
  criarRascunhoSql06NeonHml,
  atualizarCabecalhoRascunhoSql06NeonHml,
  cancelarRodizioSql06NeonHml,
  excluirRascunhoSql06NeonHml,
} from './rodizioAdminSql06HmlService';
import {
  publicarRodizioVersionadoNeonHml,
  travarRodizioVersionadoNeonHml,
} from './rodizioStatusVersionedHmlService';
import {
  salvarRascunhoAtomicoNeonHml,
} from './rodizioFunctionalHmlService';

/**
 * Entrada para criação de um novo rascunho.
 */
export interface CriacaoRascunhoNeon {
  titulo: string;
  dataInicio: string;
  dataFim: string;
  observacoes?: string | null;
}

/**
 * Entrada para atualizar apenas o cabeçalho de um rascunho.
 * A revisão esperada é a capturada ao abrir o editor.
 */
export interface AtualizacaoCabecalhoNeon {
  rodizioId: string;
  revisaoOriginal: number;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  observacoes?: string | null;
}

/**
 * Entrada para substituir todos os itens de um rascunho.
 * A revisão esperada é a capturada ao abrir o editor.
 */
export interface SubstituicaoItensNeon {
  rodizioId: string;
  itens: RodizioItemInput[];
  revisaoOriginal: number;
}

/**
 * Entrada para transição de estado: publicar ou travar.
 * A revisão esperada é a capturada ao abrir o editor.
 */
export interface TransicaoEstadoNeon {
  rodizioId: string;
  revisaoOriginal: number;
  acao: 'publicar' | 'travar' | 'cancelar';
}

/**
 * Entrada para cancelamento de um rodízio (qualquer estado).
 */
export interface CancelamentoNeon {
  rodizioId: string;
  revisaoOriginal: number;
}

/**
 * Entrada para exclusão de um rascunho.
 */
export interface ExclusaoRascunhoNeon {
  rodizioId: string;
  revisaoOriginal: number;
}

/**
 * Resultado de operação que inclui a nova revisão após sucesso.
 */
export type ResultadoComRevisao<T> = {
  data: T | null;
  error: string | null;
  novaRevisao?: number;
};

// ============================================================================
// OPERAÇÕES P0: Integração dos 7 adaptadores
// ============================================================================

/**
 * P0.1 — Criar rascunho
 * Não é idempotente: se o transporte falhar após COMMIT, novo clique
 * pode duplicar o rascunho. Reconciliação manual obrigatória.
 */
export async function criarRascunhoNeonEditor(
  entrada: CriacaoRascunhoNeon,
): Promise<ServiceResult<string>> {
  return criarRascunhoSql06NeonHml({
    titulo: entrada.titulo,
    dataInicio: entrada.dataInicio,
    dataFim: entrada.dataFim,
    observacoes: entrada.observacoes,
  });
}

/**
 * P0.2 — Atualizar cabeçalho (separadamente dos itens)
 * OCC via revisão esperada. Sob FOR UPDATE na transação SQL.
 */
export async function atualizarCabecalhoNeonEditor(
  entrada: AtualizacaoCabecalhoNeon,
): Promise<ResultadoComRevisao<number>> {
  const result = await atualizarCabecalhoRascunhoSql06NeonHml(
    entrada.rodizioId,
    entrada.revisaoOriginal,
    {
      titulo: entrada.titulo,
      dataInicio: entrada.dataInicio,
      dataFim: entrada.dataFim,
      observacoes: entrada.observacoes,
    },
  );
  if (result.error) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data,
    error: null,
    novaRevisao: result.data || undefined,
  };
}

/**
 * P0.3 — Substituir itens (separadamente do cabeçalho)
 * OCC via revisão esperada.
 */
export async function substituirItensNeonEditor(
  entrada: SubstituicaoItensNeon,
): Promise<ResultadoComRevisao<number>> {
  const result = await salvarRascunhoAtomicoNeonHml(
    entrada.rodizioId,
    entrada.itens,
    entrada.revisaoOriginal,
  );
  if (result.error) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data?.itens.length ?? null,
    error: null,
    novaRevisao: entrada.revisaoOriginal + 1,
  };
}

/**
 * P0.4 — Publicar rodízio (alteração de status)
 * Requer admin, lock, revisão e pelo menos um item.
 */
export async function publicarRodizioNeonEditor(
  entrada: TransicaoEstadoNeon,
): Promise<ResultadoComRevisao<number>> {
  if (entrada.acao !== 'publicar') {
    return { data: null, error: 'Operação inválida: esperado "publicar"' };
  }
  const result = await publicarRodizioVersionadoNeonHml(
    entrada.rodizioId,
    entrada.revisaoOriginal,
  );
  if (result.error) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data,
    error: null,
    novaRevisao: result.data || undefined,
  };
}

/**
 * P0.5 — Travar rodízio (alteração de status)
 * Requer admin, lock, revisão e pelo menos um item.
 */
export async function travarRodizioNeonEditor(
  entrada: TransicaoEstadoNeon,
): Promise<ResultadoComRevisao<number>> {
  if (entrada.acao !== 'travar') {
    return { data: null, error: 'Operação inválida: esperado "travar"' };
  }
  const result = await travarRodizioVersionadoNeonHml(
    entrada.rodizioId,
    entrada.revisaoOriginal,
  );
  if (result.error) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data,
    error: null,
    novaRevisao: result.data || undefined,
  };
}

/**
 * P0.6 — Cancelar rodízio (qualquer status)
 * Requer admin, lock e revisão.
 */
export async function cancelarRodizioNeonEditor(
  entrada: CancelamentoNeon,
): Promise<ResultadoComRevisao<number>> {
  const result = await cancelarRodizioSql06NeonHml(
    entrada.rodizioId,
    entrada.revisaoOriginal,
  );
  if (result.error) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data,
    error: null,
    novaRevisao: result.data || undefined,
  };
}

/**
 * P0.7 — Excluir rascunho
 * Requer admin, lock e revisão.
 */
export async function excluirRascunhoNeonEditor(
  entrada: ExclusaoRascunhoNeon,
): Promise<ServiceResult<boolean>> {
  return excluirRascunhoSql06NeonHml(
    entrada.rodizioId,
    entrada.revisaoOriginal,
  );
}
