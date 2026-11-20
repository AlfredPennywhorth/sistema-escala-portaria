import { criarClienteNeon } from '../../lib/neon';
import type {
  Rodizio,
  Auxiliar,
  RodizioItem,
  RodizioInput,
  RodizioItemInput,
  RodizioComItens,
  ServiceResult,
} from '../../types/supabase';

export async function listarRodizios(): Promise<ServiceResult<Rodizio[]>> {
  try {
    const { data, error } = await criarClienteNeon()
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
    const { data, error } = await criarClienteNeon()
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
    const { data, error } = await criarClienteNeon()
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
    const { data: rodizioData, error: rodizioError } = await criarClienteNeon()
      .from('rodizios')
      .select('*')
      .eq('id', rodizioId)
      .single();

    if (rodizioError) {
      return { data: null, error: rodizioError.message };
    }

    const { data: itensData, error: itensError } = await criarClienteNeon()
      .from('rodizio_itens')
      .select('*, auxiliar:auxiliares(id, nome, telefone)')
      .eq('rodizio_id', rodizioId)
      .order('data', { ascending: true });

    if (itensError) {
      return { data: null, error: itensError.message };
    }

    const formattedItens = (itensData || []).map((item: RodizioItem & { auxiliar?: Auxiliar | Auxiliar[] }) => ({
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
    const { data: rodizios, error: rodiziosError } = await criarClienteNeon()
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

    const rodizioIds = rodizios.map((r: Rodizio) => r.id);
    const { data: itensData, error: itensError } = await criarClienteNeon()
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

    const result: HistoricoRodizioComItens[] = rodizios.map((r: Rodizio) => ({
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
  _mesAno: string,
  _itens: RegistroHistoricoInput[]
): Promise<ServiceResult<Rodizio>> {
  void _mesAno;
  void _itens;
  // No deletion/replacement of locked historical items until a transactional migration is approved.
  return { data: null, error: 'Registro de histórico travado indisponível na homologação Neon. Preserve os registros anteriores.' };
}

/**
 * Rotas legadas de escrita intencionalmente desabilitadas.
 * A integração futura deverá usar RPCs atômicas, com JWT e revisão original,
 * após fechamento de privilégios DML diretos e homologação de cada transição.
 * Não reintroduzir fallback DELETE/INSERT nem UPDATE sem OCC nesta camada.
 */
const ESCRITA_BLOQUEADA = 'Escrita Neon indisponível nesta camada legada. Use somente as RPCs versionadas após homologação e autorização da migração.';

export async function criarRodizio(_input: RodizioInput): Promise<ServiceResult<Rodizio>> {
  void _input;
  return { data: null, error: ESCRITA_BLOQUEADA };
}

export async function salvarItensRodizio(
  _rodizioId: string,
  _itens: RodizioItemInput[],
): Promise<ServiceResult<RodizioItem[]>> {
  void _rodizioId; void _itens;
  return { data: null, error: ESCRITA_BLOQUEADA };
}

export async function publicarRodizio(_rodizioId: string): Promise<ServiceResult<Rodizio>> {
  void _rodizioId;
  return { data: null, error: ESCRITA_BLOQUEADA };
}

export async function travarRodizio(_rodizioId: string): Promise<ServiceResult<Rodizio>> {
  void _rodizioId;
  return { data: null, error: ESCRITA_BLOQUEADA };
}

export async function cancelarRodizio(_rodizioId: string): Promise<ServiceResult<Rodizio>> {
  void _rodizioId;
  return { data: null, error: ESCRITA_BLOQUEADA };
}

export async function excluirRodizioRascunho(_rodizioId: string): Promise<ServiceResult<null>> {
  void _rodizioId;
  return { data: null, error: ESCRITA_BLOQUEADA };
}

export async function buscarRodizioPorMesAno(ano: number, mes: number): Promise<ServiceResult<RodizioComItens | null>> {
  try {
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const { data: rodizios, error: rodiziosError } = await criarClienteNeon()
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

    const { data: itensData, error: itensError } = await criarClienteNeon()
      .from('rodizio_itens')
      .select('*, auxiliar:auxiliares(id, nome, telefone)')
      .eq('rodizio_id', rodizio.id)
      .order('data', { ascending: true });

    if (itensError) {
      return { data: null, error: itensError.message };
    }

    const formattedItens = (itensData || []).map((item: RodizioItem & { auxiliar?: Auxiliar | Auxiliar[] }) => ({
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

    const { data: rodizios, error: rodiziosError } = await criarClienteNeon()
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
      const { data: itensData, error: itensError } = await criarClienteNeon()
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