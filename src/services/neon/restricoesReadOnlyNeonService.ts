/**
 * Serviço Read-Only de restrições Neon para P2
 *
 * Bloqueia mutações (criar, atualizar, desativar) até aprovação específica.
 * Apenas listagem e consulta são permitidas.
 *
 * Restrições de segurança:
 * - Nenhuma escrita direta em `restricoes_auxiliares`
 * - Sem fallback Supabase
 * - Sem bypass silencioso para operações de escrita
 */

import { criarClienteNeon } from '../../lib/neon';
import type { RestricaoAuxiliar, RestricaoFiltros, ServiceResult } from '../../types/supabase';

export async function listarRestricoesParaLeitura(
  filtros?: RestricaoFiltros
): Promise<ServiceResult<RestricaoAuxiliar[]>> {
  try {
    let query = criarClienteNeon()
      .from('restricoes_auxiliares')
      .select('*')
      .order('created_at', { ascending: true });

    if (filtros?.auxiliarId) {
      query = query.eq('auxiliar_id', filtros.auxiliarId);
    }

    if (filtros?.dataInicio) {
      query = query.or(`data.gte.${filtros.dataInicio},and(data.is.null,dia_semana.not.is.null)`);
    }

    if (filtros?.diaSemana !== undefined) {
      query = query.eq('dia_semana', filtros.diaSemana);
    }

    if (filtros?.porta) {
      query = query.eq('porta', filtros.porta);
    }

    if (!filtros?.incluirInativas) {
      query = query.eq('ativa', true);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as RestricaoAuxiliar[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar restrições' };
  }
}

export async function listarRestricoesAtivasParaLeitura(): Promise<ServiceResult<RestricaoAuxiliar[]>> {
  return listarRestricoesParaLeitura({ incluirInativas: false });
}

export async function listarRestricoesPorAuxiliarEPeriodoParaLeitura(
  auxiliarId: string,
  dataInicio: string,
  dataFim: string
): Promise<ServiceResult<RestricaoAuxiliar[]>> {
  try {
    const { data, error } = await criarClienteNeon()
      .from('restricoes_auxiliares')
      .select('*')
      .eq('auxiliar_id', auxiliarId)
      .eq('ativa', true)
      .or(`and(data.gte.${dataInicio},data.lte.${dataFim}),and(data.is.null,dia_semana.not.is.null)`);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as RestricaoAuxiliar[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar restrições por período' };
  }
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function criarRestricaoBloqueada(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Criação de restrições está bloqueada. Aguardando aprovação de segurança.',
  };
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function atualizarRestricaoBloqueada(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Atualização de restrições está bloqueada. Aguardando aprovação de segurança.',
  };
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function desativarRestricaoBloqueada(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Desativação de restrições está bloqueada. Aguardando aprovação de segurança.',
  };
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function reativarRestricaoBloqueada(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Reativação de restrições está bloqueada. Aguardando aprovação de segurança.',
  };
}
