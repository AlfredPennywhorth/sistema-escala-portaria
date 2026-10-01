import * as rodiziosService from '../services/rodiziosService';
import * as auxiliaresService from '../services/auxiliaresService';
import * as restricoesService from '../services/restricoesService';
import type { EntradaGeracaoRodizio, RestricaoInfo, HistoricoRodizio } from '../types/geracaoRodizio';
import type { Auxiliar } from '../types/supabase';

export interface DadosPreparadosGeracao {
  portas: Array<{ id: string; nome: string }>;
  diasAtivos: string[];
  auxiliares: Array<{ id: string; nome: string; ativa: boolean }>;
  restricoes: RestricaoInfo[];
  historicoTravado: HistoricoRodizio[];
  erro: string | null;
}

const LOCAIS = [
  { id: 'l1', nome: 'Entrada' },
  { id: 'l2', nome: 'Galeria' },
  { id: 'l3', nome: 'Lateral' },
  { id: 'l4', nome: 'Sanitário' },
];

const DIAS_ATIVOS = ['Domingo', 'Terça-Feira', 'Sábado'];

export async function prepararDadosParaGeracaoRodizio(): Promise<DadosPreparadosGeracao> {
  const [historicoResult, auxiliaresResult, restricoesResult] = await Promise.all([
    rodiziosService.listarRodiziosTravadosComItens(),
    auxiliaresService.listarAuxiliares(false),
    restricoesService.listarRestricoes({}),
  ]);

  if (historicoResult.error) {
    return {
      portas: LOCAIS,
      diasAtivos: DIAS_ATIVOS,
      auxiliares: [],
      restricoes: [],
      historicoTravado: [],
      erro: 'Erro ao carregar histórico: ' + historicoResult.error,
    };
  }

  if (auxiliaresResult.error || !auxiliaresResult.data) {
    return {
      portas: LOCAIS,
      diasAtivos: DIAS_ATIVOS,
      auxiliares: [],
      restricoes: [],
      historicoTravado: historicoResult.data || [],
      erro: 'Erro ao carregar auxiliares: ' + (auxiliaresResult.error || 'Nenhuma auxiliar'),
    };
  }

  if (auxiliaresResult.data.length === 0) {
    return {
      portas: LOCAIS,
      diasAtivos: DIAS_ATIVOS,
      auxiliares: [],
      restricoes: [],
      historicoTravado: historicoResult.data || [],
      erro: 'Não há auxiliares ativas no sistema.',
    };
  }

  return {
    portas: LOCAIS,
    diasAtivos: DIAS_ATIVOS,
    auxiliares: auxiliaresResult.data.map((a: Auxiliar) => ({
      id: a.id,
      nome: a.nome,
      ativa: a.ativa,
    })),
    restricoes: restricoesResult.data?.map((r) => ({
      id: r.id,
      auxiliarId: r.auxiliar_id,
      data: r.data,
      dia_semana: r.dia_semana,
      porta: r.porta,
      tipo: r.tipo as 'indisponivel' | 'preferencia' | 'evitar' | 'observacao',
      motivo: r.motivo,
      ativa: r.ativa,
    })) || [],
    historicoTravado: historicoResult.data || [],
    erro: null,
  };
}

export function criarEntradaGeracaoRodizio(
  dados: DadosPreparadosGeracao,
  dataInicio: string,
  dataFim: string
): EntradaGeracaoRodizio {
  return {
    dataInicio,
    dataFim,
    portas: dados.portas,
    diasAtivos: dados.diasAtivos,
    auxiliares: dados.auxiliares,
    restricoes: dados.restricoes,
    historicoTravado: dados.historicoTravado,
  };
}

export async function buscarRodizioRascunhoDoMes(
  ano: number,
  mes: number
): Promise<{ id: string; titulo: string; data_inicio: string; data_fim: string; travado: boolean } | null> {
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const result = await rodiziosService.listarRodizios();
  
  if (result.error || !result.data) {
    return null;
  }

  const rascunhos = result.data.filter(r => 
    r.status === 'rascunho' && 
    !r.travado &&
    r.data_inicio <= dataFim &&
    r.data_fim >= dataInicio
  );

  if (rascunhos.length === 0) {
    return null;
  }

  return {
    id: rascunhos[0].id,
    titulo: rascunhos[0].titulo,
    data_inicio: rascunhos[0].data_inicio,
    data_fim: rascunhos[0].data_fim,
    travado: rascunhos[0].travado,
  };
}