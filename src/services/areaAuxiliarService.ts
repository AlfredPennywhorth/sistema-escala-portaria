import { supabase } from '../lib/supabase';
import type { Rodizio, RodizioItem, Auxiliar } from '../types/supabase';
import type { ServiceResult } from '../types/supabase';

export async function obterMinhaAuxiliar(): Promise<ServiceResult<Auxiliar | null>> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      return { data: null, error: sessionError.message };
    }

    if (!sessionData.session?.user) {
      return { data: null, error: null };
    }

    const userId = sessionData.session.user.id;

    const { data: perfilData, error: perfilError } = await supabase
      .from('usuarios_auxiliares')
      .select('auxiliar_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (perfilError) {
      return { data: null, error: perfilError.message };
    }

    if (!perfilData?.auxiliar_id) {
      return { data: null, error: null };
    }

    const { data: auxiliarData, error: auxiliarError } = await supabase
      .from('auxiliares')
      .select('*')
      .eq('id', perfilData.auxiliar_id)
      .single();

    if (auxiliarError) {
      return { data: null, error: auxiliarError.message };
    }

    return { data: auxiliarData as Auxiliar, error: null };
  } catch {
    return { data: null, error: 'Erro ao obter dados da auxiliar' };
  }
}

export async function listarEscalasPublicadasOuTravadas(): Promise<ServiceResult<Rodizio[]>> {
  try {
    const { data, error } = await supabase
      .from('rodizios')
      .select('*')
      .or('status.eq.publicado,status.eq.travado')
      .order('data_inicio', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar escalas' };
  }
}

export async function listarEscalasPublicadasOuTravadasPorAuxiliar(
  auxiliarId: string
): Promise<ServiceResult<Rodizio[]>> {
  try {
    const { data: rodiziosData, error: rodiziosError } = await supabase
      .from('rodizios')
      .select('id, titulo, data_inicio, data_fim, status, travado, travado_em, observacoes, created_at')
      .or('status.eq.publicado,status.eq.travado')
      .order('data_inicio', { ascending: false });

    if (rodiziosError) {
      return { data: null, error: rodiziosError.message };
    }

    if (!rodiziosData || rodiziosData.length === 0) {
      return { data: [], error: null };
    }

    const rodizioIds = rodiziosData.map(r => r.id);

    const { data: itensData, error: itensError } = await supabase
      .from('rodizio_itens')
      .select('rodizio_id')
      .eq('auxiliar_id', auxiliarId)
      .in('rodizio_id', rodizioIds);

    if (itensError) {
      return { data: null, error: itensError.message };
    }

    const rodiziosComItem = new Set(itensData?.map(i => i.rodizio_id) || []);
    const rodiziosFiltrados = rodiziosData.filter(r => rodiziosComItem.has(r.id));

    return { data: rodiziosFiltrados as Rodizio[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar escalas por auxiliar' };
  }
}

export async function listarProximaEscala(auxiliarId: string): Promise<ServiceResult<RodizioItem | null>> {
  try {
    const hoje = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('rodizio_itens')
      .select('*, rodizios:titulo')
      .eq('auxiliar_id', auxiliarId)
      .gte('data', hoje)
      .or('rodizios.status.eq.publicado,rodizios.status.eq.travado')
      .order('data', { ascending: true })
      .limit(1);

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data || data.length === 0) {
      return { data: null, error: null };
    }

    return { data: data[0] as RodizioItem, error: null };
  } catch {
    return { data: null, error: 'Erro ao buscar próxima escala' };
  }
}

export async function listarMinhasEscalas(auxiliarId: string): Promise<ServiceResult<(RodizioItem & { rodizio?: Rodizio })[]>> {
  try {
    const hoje = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('rodizio_itens')
      .select('*, rodizios(id, titulo, data_inicio, data_fim, status, travado)')
      .eq('auxiliar_id', auxiliarId)
      .gte('data', hoje)
      .order('data', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data || []) as (RodizioItem & { rodizio?: Rodizio })[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar minhas escalas' };
  }
}

export async function listarEscalaCompletaPublicada(rodizioId: string): Promise<ServiceResult<RodizioItem[]>> {
  try {
    const { data, error } = await supabase
      .from('rodizio_itens')
      .select('*, auxiliares(nome)')
      .eq('rodizio_id', rodizioId)
      .order('data', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data || []) as RodizioItem[], error: null };
  } catch {
    return { data: null, error: 'Erro ao carregar escala completa' };
  }
}

export async function listarMinhasDatas(auxiliarId: string): Promise<ServiceResult<RodizioItem[]>> {
  try {
    const { data, error } = await supabase
      .from('rodizio_itens')
      .select('*, rodizios(titulo, status, travado)')
      .eq('auxiliar_id', auxiliarId)
      .order('data', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data || []) as RodizioItem[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar minhas datas' };
  }
}