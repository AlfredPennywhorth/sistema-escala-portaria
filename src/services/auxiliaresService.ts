import { supabase } from '../lib/supabase';
import type {
  Auxiliar,
  AuxiliarInput,
  ServiceResult,
} from '../types/supabase';

export async function listarAuxiliares(incluirInativas = false): Promise<ServiceResult<Auxiliar[]>> {
  try {
    let query = supabase
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

export async function obterAuxiliarPorId(id: string): Promise<ServiceResult<Auxiliar | null>> {
  try {
    const { data, error } = await supabase
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

export async function criarAuxiliar(input: AuxiliarInput): Promise<ServiceResult<Auxiliar>> {
  if (!input.nome || input.nome.trim() === '') {
    return { data: null, error: 'Nome é obrigatório' };
  }

  try {
    const { data, error } = await supabase
      .from('auxiliares')
      .insert({
        nome: input.nome.trim(),
        telefone: input.telefone ?? null,
        email: input.email ?? null,
        observacoes: input.observacoes ?? null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Auxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao criar auxiliar' };
  }
}

export async function atualizarAuxiliar(id: string, input: Partial<AuxiliarInput>): Promise<ServiceResult<Auxiliar>> {
  try {
    const updates: Record<string, unknown> = {};

    if (input.nome !== undefined) {
      if (input.nome.trim() === '') {
        return { data: null, error: 'Nome não pode ser vazio' };
      }
      updates.nome = input.nome.trim();
    }

    if (input.telefone !== undefined) {
      updates.telefone = input.telefone ?? null;
    }

    if (input.email !== undefined) {
      updates.email = input.email ?? null;
    }

    if (input.observacoes !== undefined) {
      updates.observacoes = input.observacoes ?? null;
    }

    const { data, error } = await supabase
      .from('auxiliares')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Auxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao atualizar auxiliar' };
  }
}

export async function desativarAuxiliar(id: string): Promise<ServiceResult<Auxiliar>> {
  try {
    const { data, error } = await supabase
      .from('auxiliares')
      .update({ ativa: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Auxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao desativar auxiliar' };
  }
}

export async function reativarAuxiliar(id: string): Promise<ServiceResult<Auxiliar>> {
  try {
    const { data, error } = await supabase
      .from('auxiliares')
      .update({ ativa: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Auxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao reativar auxiliar' };
  }
}