/**
 * Serviço Read-Only de auxiliares Neon para P2
 *
 * Bloqueia mutações (criar, atualizar, desativar) até aprovação específica.
 * Apenas listagem e consulta são permitidas.
 *
 * Restrições de segurança:
 * - Nenhuma escrita direta em `auxiliares` ou `restricoes_auxiliares`
 * - Sem fallback Supabase
 * - Sem bypass silencioso para operações de escrita
 */

import { criarClienteNeon } from '../../lib/neon';
import type { Auxiliar, ServiceResult } from '../../types/supabase';

export async function listarAuxiliaresParaLeitura(incluirInativas = false): Promise<ServiceResult<Auxiliar[]>> {
  try {
    let query = criarClienteNeon()
      .from('auxiliares')
      .select('*')
      .order('nome', { ascending: true });

    if (!incluirInativas) {
      query = query.eq('ativa', true);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Auxiliar[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar auxiliares' };
  }
}

export async function obterAuxiliarParaLeitura(id: string): Promise<ServiceResult<Auxiliar | null>> {
  try {
    const { data, error } = await criarClienteNeon()
      .from('auxiliares')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Auxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao obter auxiliar' };
  }
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function criarAuxiliarBloqueado(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Criação de auxiliares está bloqueada. Aguardando aprovação de segurança.',
  };
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function atualizarAuxiliarBloqueado(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Atualização de auxiliares está bloqueada. Aguardando aprovação de segurança.',
  };
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function desativarAuxiliarBloqueado(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Desativação de auxiliares está bloqueada. Aguardando aprovação de segurança.',
  };
}

/**
 * Bloqueia escrita — P2 não está autorizado
 */
export async function reativarAuxiliarBloqueado(): Promise<ServiceResult<null>> {
  return {
    data: null,
    error: 'P2: Reativação de auxiliares está bloqueada. Aguardando aprovação de segurança.',
  };
}
