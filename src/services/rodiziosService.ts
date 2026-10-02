import { supabase } from '../lib/supabase';
import type {
  Rodizio,
  RodizioItem,
  RodizioInput,
  RodizioItemInput,
  RodizioComItens,
  ServiceResult,
} from '../types/supabase';

export async function listarRodizios(): Promise<ServiceResult<Rodizio[]>> {
  try {
    const { data, error } = await supabase
      .from('rodizios')
      .select('*')
      .order('data_inicio', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar rodízios' };
  }
}

export async function listarRodiziosPublicadosOuTravados(): Promise<ServiceResult<Rodizio[]>> {
  try {
    const { data, error } = await supabase
      .from('rodizios')
      .select('*')
      .or('status.eq.publicado,status.eq.travado,travado.eq.true')
      .order('data_inicio', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar rodízios publicados ou travados' };
  }
}

export async function listarHistoricoTravado(): Promise<ServiceResult<Rodizio[]>> {
  try {
    const { data, error } = await supabase
      .from('rodizios')
      .select('*')
      .eq('travado', true)
      .order('travado_em', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio[], error: null };
  } catch {
    return { data: null, error: 'Erro ao listar histórico travado' };
  }
}

export async function obterRodizioComItens(rodizioId: string): Promise<ServiceResult<RodizioComItens | null>> {
  try {
    const { data: rodizioData, error: rodizioError } = await supabase
      .from('rodizios')
      .select('*')
      .eq('id', rodizioId)
      .single();

    if (rodizioError) {
      return { data: null, error: rodizioError.message };
    }

    const { data: itensData, error: itensError } = await supabase
      .from('rodizio_itens')
      .select('*, auxiliar:auxiliares(id, nome, telefone)')
      .eq('rodizio_id', rodizioId)
      .order('data', { ascending: true });

    if (itensError) {
      return { data: null, error: itensError.message };
    }

    const formattedItens = (itensData || []).map(item => ({
      ...item,
      auxiliar: Array.isArray(item.auxiliar) ? item.auxiliar[0] : item.auxiliar,
    }));

    return {
      data: {
        rodizio: rodizioData as Rodizio,
        itens: formattedItens,
      },
      error: null,
    };
  } catch {
    return { data: null, error: 'Erro ao obter rodízio com itens' };
  }
}

export async function listarRodiziosTravadosComItens(): Promise<ServiceResult<HistoricoRodizioComItens[]>> {
  try {
    const { data: rodizios, error: rodiziosError } = await supabase
      .from('rodizios')
      .select('*')
      .eq('travado', true)
      .order('travado_em', { ascending: false });

    if (rodiziosError) {
      return { data: null, error: rodiziosError.message };
    }

    if (!rodizios || rodizios.length === 0) {
      return { data: [], error: null };
    }

    const rodizioIds = rodizios.map(r => r.id);
    const { data: itensData, error: itensError } = await supabase
      .from('rodizio_itens')
      .select('*')
      .in('rodizio_id', rodizioIds);

    if (itensError) {
      return { data: null, error: itensError.message };
    }

    const itensPorRodizio: Record<string, HistoricoItem[]> = {};
    for (const item of (itensData || [])) {
      if (!itensPorRodizio[item.rodizio_id]) {
        itensPorRodizio[item.rodizio_id] = [];
      }
      if (item.auxiliar_id) {
        itensPorRodizio[item.rodizio_id].push({
          rodizioId: item.rodizio_id,
          data: item.data,
          porta: item.porta,
          periodo: item.periodo,
          auxiliarId: item.auxiliar_id,
        });
      }
    }

    const result: HistoricoRodizioComItens[] = rodizios.map(r => ({
      id: r.id,
      titulo: r.titulo,
      dataInicio: r.data_inicio,
      dataFim: r.data_fim,
      itens: itensPorRodizio[r.id] || [],
    }));

    return { data: result, error: null };
  } catch {
    return { data: null, error: 'Erro ao listar histórico travado com itens' };
  }
}

export interface HistoricoRodizioComItens {
  id: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  itens: HistoricoItem[];
}

interface HistoricoItem {
  rodizioId: string;
  data: string;
  porta: string;
  periodo?: string | null;
  auxiliarId: string;
}

export interface RegistroHistoricoInput {
  data: string;
  porta: string;
  auxiliar_id: string;
  observacoes?: string | null;
}

export async function registrarHistoricoRealizado(
  mesAno: string,
  itens: RegistroHistoricoInput[]
): Promise<ServiceResult<Rodizio>> {
  try {
    const tituloHistorico = `Histórico Realizado — ${mesAno}`;
    
    const { data: existente } = await supabase
      .from('rodizios')
      .select('id')
      .eq('titulo', tituloHistorico)
      .eq('travado', true)
      .single();

    let rodizioId: string;

    if (existente) {
      rodizioId = existente.id;
      
      const { error: deleteError } = await supabase
        .from('rodizio_itens')
        .delete()
        .eq('rodizio_id', rodizioId);

      if (deleteError) {
        return { data: null, error: 'Erro ao limpar histórico existente: ' + deleteError.message };
      }
    } else {
      const dataAtual = new Date();
      const [mes, ano] = mesAno.split('/');
      const primeiroDia = `${ano}-${mes.padStart(2, '0')}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];

      const { data: novoRodizio, error: criarError } = await supabase
        .from('rodizios')
        .insert({
          titulo: tituloHistorico,
          data_inicio: primeiroDia,
          data_fim: ultimoDia,
          status: 'travado',
          travado: true,
          travado_em: dataAtual.toISOString(),
          observacoes: 'Histórico realizado registrado automaticamente',
        })
        .select()
        .single();

      if (criarError) {
        return { data: null, error: 'Erro ao criar histórico: ' + criarError.message };
      }

      rodizioId = novoRodizio.id;
    }

    if (itens.length === 0) {
      return { data: null, error: 'Nenhum item para salvar no histórico' };
    }

    const itensToInsert = itens.map(item => ({
      rodizio_id: rodizioId,
      data: item.data,
      porta: item.porta,
      periodo: null,
      auxiliar_id: item.auxiliar_id,
      observacoes: item.observacoes || null,
    }));

    const { error: insertError } = await supabase
      .from('rodizio_itens')
      .insert(itensToInsert);

    if (insertError) {
      return { data: null, error: 'Erro ao salvar itens do histórico: ' + insertError.message };
    }

    const { data: rodizioFinal } = await supabase
      .from('rodizios')
      .select('*')
      .eq('id', rodizioId)
      .single();

    return { data: rodizioFinal as Rodizio, error: null };
  } catch {
    return { data: null, error: 'Erro ao registrar histórico realizado' };
  }
}

export async function criarRodizio(input: RodizioInput): Promise<ServiceResult<Rodizio>> {
  if (!input.titulo?.trim()) {
    return { data: null, error: 'Título é obrigatório' };
  }

  if (!input.data_inicio) {
    return { data: null, error: 'Data de início é obrigatória' };
  }

  if (!input.data_fim) {
    return { data: null, error: 'Data de fim é obrigatória' };
  }

  try {
    const { data, error } = await supabase
      .from('rodizios')
      .insert({
        titulo: input.titulo.trim(),
        data_inicio: input.data_inicio,
        data_fim: input.data_fim,
        status: 'rascunho',
        travado: false,
        observacoes: input.observacoes ?? null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio, error: null };
  } catch {
    return { data: null, error: 'Erro ao criar rodízio' };
  }
}

export async function salvarItensRodizio(
  rodizioId: string,
  itens: RodizioItemInput[]
): Promise<ServiceResult<RodizioItem[]>> {
  try {
    const { data: rodizioData, error: rodizioError } = await supabase
      .from('rodizios')
      .select('id, travado, status')
      .eq('id', rodizioId)
      .single();

    if (rodizioError) {
      return { data: null, error: rodizioError.message };
    }

    if (rodizioData.travado) {
      return { data: null, error: 'Não é permitido alterar itens de um rodízio travado' };
    }

    const { error: deleteError } = await supabase
      .from('rodizio_itens')
      .delete()
      .eq('rodizio_id', rodizioId);

    if (deleteError) {
      return { data: null, error: deleteError.message };
    }

    if (itens.length === 0) {
      return { data: [], error: null };
    }

    const itensToInsert = itens.map(item => ({
      rodizio_id: rodizioId,
      data: item.data,
      porta: item.porta,
      periodo: item.periodo ?? null,
      auxiliar_id: item.auxiliar_id ?? null,
      observacoes: item.observacoes ?? null,
    }));

    const { data, error } = await supabase
      .from('rodizio_itens')
      .insert(itensToInsert)
      .select();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as RodizioItem[], error: null };
  } catch {
    return { data: null, error: 'Erro ao salvar itens do rodízio' };
  }
}

export async function publicarRodizio(rodizioId: string): Promise<ServiceResult<Rodizio>> {
  try {
    const { data: rodizioData, error: rodizioError } = await supabase
      .from('rodizios')
      .select('id, travado, status')
      .eq('id', rodizioId)
      .single();

    if (rodizioError) {
      return { data: null, error: rodizioError.message };
    }

    if (rodizioData.travado) {
      return { data: null, error: 'Rodízio travado não pode ser publicado diretamente' };
    }

    const { data, error } = await supabase
      .from('rodizios')
      .update({ status: 'publicado' })
      .eq('id', rodizioId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio, error: null };
  } catch {
    return { data: null, error: 'Erro ao publicar rodízio' };
  }
}

export async function travarRodizio(rodizioId: string): Promise<ServiceResult<Rodizio>> {
  try {
    const { data: rodizioData, error: rodizioError } = await supabase
      .from('rodizios')
      .select('id, travado, status')
      .eq('id', rodizioId)
      .single();

    if (rodizioError) {
      return { data: null, error: rodizioError.message };
    }

    if (rodizioData.travado) {
      return { data: null, error: 'Rodízio já está travado' };
    }

    const { count, error: countError } = await supabase
      .from('rodizio_itens')
      .select('*', { count: 'exact', head: true })
      .eq('rodizio_id', rodizioId);

    if (countError) {
      return { data: null, error: countError.message };
    }

    if (count === 0) {
      return { data: null, error: 'Não é possível travar um rodízio sem itens. Adicione pelo menos um item antes de travar.' };
    }

    const { data, error } = await supabase
      .from('rodizios')
      .update({
        status: 'travado',
        travado: true,
        travado_em: new Date().toISOString(),
      })
      .eq('id', rodizioId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio, error: null };
  } catch {
    return { data: null, error: 'Erro ao travar rodízio' };
  }
}

export async function cancelarRodizio(rodizioId: string): Promise<ServiceResult<Rodizio>> {
  try {
    const { data: rodizioData, error: rodizioError } = await supabase
      .from('rodizios')
      .select('id, travado')
      .eq('id', rodizioId)
      .single();

    if (rodizioError) {
      return { data: null, error: rodizioError.message };
    }

    if (rodizioData.travado) {
      return { data: null, error: 'Rodízio travado não pode ser cancelado' };
    }

    const { data, error } = await supabase
      .from('rodizios')
      .update({ status: 'cancelado' })
      .eq('id', rodizioId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Rodizio, error: null };
  } catch {
    return { data: null, error: 'Erro ao cancelar rodízio' };
  }
}

export async function excluirRodizioRascunho(rodizioId: string): Promise<ServiceResult<null>> {
  try {
    const { data: rodizioData, error: rodizioError } = await supabase
      .from('rodizios')
      .select('id, status, travado')
      .eq('id', rodizioId)
      .single();

    if (rodizioError) {
      return { data: null, error: rodizioError.message };
    }

    if (rodizioData.status !== 'rascunho') {
      return { data: null, error: 'Apenas rodízios em rascunho podem ser excluídos' };
    }

    if (rodizioData.travado) {
      return { data: null, error: 'Rodízio travado não pode ser excluído' };
    }

    const { error } = await supabase
      .from('rodizios')
      .delete()
      .eq('id', rodizioId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: 'Erro ao excluir rodízio' };
  }
}

export async function buscarRodizioPorMesAno(ano: number, mes: number): Promise<ServiceResult<RodizioComItens | null>> {
  try {
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const { data: rodizios, error: rodiziosError } = await supabase
      .from('rodizios')
      .select('*')
      .or(`status.eq.publicado,status.eq.travado,travado.eq.true`)
      .lte('data_inicio', dataFim)
      .gte('data_fim', dataInicio)
      .order('travado', { ascending: false })
      .order('data_inicio', { ascending: false })
      .limit(1);

    if (rodiziosError) {
      return { data: null, error: rodiziosError.message };
    }

    if (!rodizios || rodizios.length === 0) {
      return { data: null, error: null };
    }

    const rodizio = rodizios[0];

    const { data: itensData, error: itensError } = await supabase
      .from('rodizio_itens')
      .select('*, auxiliar:auxiliares(id, nome, telefone)')
      .eq('rodizio_id', rodizio.id)
      .order('data', { ascending: true });

    if (itensError) {
      return { data: null, error: itensError.message };
    }

    const formattedItens = (itensData || []).map(item => ({
      ...item,
      auxiliar: Array.isArray(item.auxiliar) ? item.auxiliar[0] : item.auxiliar,
    }));

    return {
      data: {
        rodizio: rodizio as Rodizio,
        itens: formattedItens,
      },
      error: null,
    };
  } catch {
    return { data: null, error: 'Erro ao buscar rodízio do mês' };
  }
}

export interface ItemEscalaConsolidado {
  data: string;
  porta: string;
  auxiliarId: string;
  auxiliarNome: string;
  origem: 'oficial' | 'historico';
  rodizioId: string;
}

export interface EscalaMensalConsolidada {
  rodizioOficial: Rodizio | null;
  historicoRealizado: Rodizio | null;
  itensConsolidados: ItemEscalaConsolidado[];
  totalItensOficial: number;
  totalItensHistorico: number;
  totalConsolidado: number;
}

export async function buscarEscalaMensalConsolidada(
  ano: number,
  mes: number
): Promise<ServiceResult<EscalaMensalConsolidada | null>> {
  try {
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const { data: rodizios, error: rodiziosError } = await supabase
      .from('rodizios')
      .select('*')
      .or(`status.eq.publicado,status.eq.travado,travado.eq.true`)
      .lte('data_inicio', dataFim)
      .gte('data_fim', dataInicio)
      .order('travado', { ascending: false })
      .order('data_inicio', { ascending: false });

    if (rodiziosError) {
      return { data: null, error: rodiziosError.message };
    }

    let rodizioOficial: Rodizio | null = null;
    let historicoRealizado: Rodizio | null = null;

    if (rodizios && rodizios.length > 0) {
      for (const r of rodizios) {
        if (r.titulo.includes('Histórico Realizado')) {
          historicoRealizado = r as Rodizio;
        } else {
          rodizioOficial = r as Rodizio;
        }
      }
    }

    const itensConsolidados: ItemEscalaConsolidado[] = [];
    const chaveExistente = new Set<string>();

    const buscarEProcessarItens = async (rodizioId: string, origem: 'oficial' | 'historico') => {
      const { data: itensData, error: itensError } = await supabase
        .from('rodizio_itens')
        .select('*, auxiliar:auxiliares(id, nome, telefone)')
        .eq('rodizio_id', rodizioId)
        .order('data', { ascending: true });

      if (itensError) {
        console.error('Erro ao buscar itens:', itensError);
        return;
      }

      if (!itensData) return;

      for (const item of itensData) {
        const auxiliar = Array.isArray(item.auxiliar) ? item.auxiliar[0] : item.auxiliar;
        if (!auxiliar || !auxiliar.id) continue;

        const chave = `${item.data}-${item.porta.toLowerCase()}`;
        
        if (origem === 'historico') {
          chaveExistente.add(chave);
        }

        if (origem === 'oficial' && chaveExistente.has(chave)) {
          continue;
        }

        itensConsolidados.push({
          data: item.data,
          porta: item.porta,
          auxiliarId: auxiliar.id,
          auxiliarNome: auxiliar.nome,
          origem,
          rodizioId: item.rodizio_id,
        });
      }
    };

    if (historicoRealizado) {
      await buscarEProcessarItens(historicoRealizado.id, 'historico');
    }

    if (rodizioOficial) {
      await buscarEProcessarItens(rodizioOficial.id, 'oficial');
    }

    const totalItensOficial = itensConsolidados.filter(i => i.origem === 'oficial').length;
    const totalItensHistorico = itensConsolidados.filter(i => i.origem === 'historico').length;

    return {
      data: {
        rodizioOficial,
        historicoRealizado,
        itensConsolidados: itensConsolidados.sort((a, b) => a.data.localeCompare(b.data)),
        totalItensOficial,
        totalItensHistorico,
        totalConsolidado: itensConsolidados.length,
      },
      error: null,
    };
  } catch (err) {
    console.error('Erro ao consolidar escala mensal:', err);
    return { data: null, error: 'Erro ao buscar escala consolidada do mês' };
  }
}