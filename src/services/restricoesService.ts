import { supabase } from '../lib/supabase';
import type {
  RestricaoAuxiliar,
  RestricaoInput,
  RestricaoFiltros,
  ServiceResult,
} from '../types/supabase';

export async function listarRestricoes(filtros?: RestricaoFiltros): Promise<ServiceResult<RestricaoAuxiliar[]>> {
  try {
    let query = supabase
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

export async function listarRestricoesAtivas(): Promise<ServiceResult<RestricaoAuxiliar[]>> {
  return listarRestricoes({ incluirInativas: false });
}

export async function listarRestricoesPorAuxiliarEPeriodo(
  auxiliarId: string,
  dataInicio: string,
  _dataFim: string
): Promise<ServiceResult<RestricaoAuxiliar[]>> {
  void _dataFim; // unused parameter
  try {
    const { data, error } = await supabase
      .from('restricoes_auxiliares')
      .select('*')
      .eq('auxiliar_id', auxiliarId)
      .eq('ativa', true)
      .or(`data.gte.${dataInicio},and(data.is.null,dia_semana.not.is.null)`);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as RestricaoAuxiliar[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar restrições por período' };
  }
}

export async function criarRestricao(input: RestricaoInput): Promise<ServiceResult<RestricaoAuxiliar>> {
  if (!input.auxiliar_id) {
    return { data: null, error: 'Auxiliar é obrigatória' };
  }

  if (!input.data && input.dia_semana === undefined) {
    return { data: null, error: 'Informe a data ou o dia da semana para a restrição' };
  }

  try {
    const { data, error } = await supabase
      .from('restricoes_auxiliares')
      .insert({
        auxiliar_id: input.auxiliar_id,
        data: input.data || null,
        dia_semana: input.dia_semana ?? null,
        porta: input.porta || null,
        tipo: input.tipo ?? 'indisponivel',
        motivo: input.motivo ?? null,
        ativa: input.ativa !== false,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as RestricaoAuxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao criar restrição' };
  }
}

export async function atualizarRestricao(
  id: string,
  input: Partial<RestricaoInput>
): Promise<ServiceResult<RestricaoAuxiliar>> {
  try {
    const updates: Record<string, unknown> = {};

    if (input.data !== undefined) {
      updates.data = input.data;
    }

    if (input.dia_semana !== undefined) {
      updates.dia_semana = input.dia_semana;
    }

    if (input.porta !== undefined) {
      updates.porta = input.porta;
    }

    if (input.tipo !== undefined) {
      updates.tipo = input.tipo;
    }

    if (input.motivo !== undefined) {
      updates.motivo = input.motivo;
    }

    if (input.ativa !== undefined) {
      updates.ativa = input.ativa;
    }

    if (input.auxiliar_id !== undefined) {
      updates.auxiliar_id = input.auxiliar_id;
    }

    const { data, error } = await supabase
      .from('restricoes_auxiliares')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as RestricaoAuxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao atualizar restrição' };
  }
}

export async function excluirRestricao(id: string): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase
      .from('restricoes_auxiliares')
      .delete()
      .eq('id', id);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: 'Erro ao excluir restrição' };
  }
}

export async function desativarRestricao(id: string): Promise<ServiceResult<RestricaoAuxiliar>> {
  return atualizarRestricao(id, { ativa: false });
}

export async function reativarRestricao(id: string): Promise<ServiceResult<RestricaoAuxiliar>> {
  return atualizarRestricao(id, { ativa: true });
}

export async function listarRestricoesPorPeriodo(
  dataInicio: string,
  _dataFim: string
): Promise<ServiceResult<RestricaoAuxiliar[]>> {
  void _dataFim; // unused parameter
  try {
    const { data, error } = await supabase
      .from('restricoes_auxiliares')
      .select('*')
      .eq('ativa', true)
      .or(`data.gte.${dataInicio},and(data.is.null,dia_semana.not.is.null)`);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as RestricaoAuxiliar[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar restrições por período' };
  }
}

export function verificarRestricaoAtiva(
  restricao: RestricaoAuxiliar,
  data: string,
  porta: string
): { bloqueada: boolean; motivo: string } {
  if (!restricao.ativa) {
    return { bloqueada: false, motivo: '' };
  }

  if (restricao.tipo === 'indisponivel' && restricao.ativa) {
    let matches = false;

    if (restricao.data && restricao.data === data) {
      matches = true;
    }

    if (restricao.dia_semana !== null && restricao.dia_semana !== undefined) {
      const dateObj = new Date(data);
      if (dateObj.getDay() === restricao.dia_semana) {
        matches = true;
      }
    }

    if (matches && restricao.porta && restricao.porta === porta) {
      return { bloqueada: true, motivo: restricao.motivo || 'Restrição ativa' };
    }

    if (matches && !restricao.porta) {
      return { bloqueada: true, motivo: restricao.motivo || 'Restrição ativa' };
    }
  }

  return { bloqueada: false, motivo: '' };
}