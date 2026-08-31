export interface AuxiliarInfo {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  ativa?: boolean;
}

export interface PortaInfo {
  id: string;
  nome: string;
}

export interface PeriodoInfo {
  id: string;
  nome: string;
}

export interface RestricaoInfo {
  id: string;
  auxiliarId: string;
  data: string | null;
  dia_semana: number | null;
  porta: string | null;
  tipo: 'indisponivel' | 'preferencia' | 'evitar' | 'observacao';
  motivo?: string | null;
  ativa?: boolean;
}

export interface HistoricoItem {
  rodizioId: string;
  data: string;
  porta: string;
  periodo?: string | null;
  auxiliarId: string;
}

export interface HistoricoRodizio {
  id: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  itens: HistoricoItem[];
}

export interface ConfiguracaoPesos {
  pesoHistorico: number;
  pesoNovoRodizio: number;
  pesoRepeticaoPorta: number;
  pesoSequencia: number;
  pesoRestricaoEvitar: number;
  pesoRepeticaoConsecutiva: number;
  bonusPrefencia: number;
}

export interface ViolacaoRestricao {
  data: string;
  porta: string;
  auxiliar: string;
  restricao: string;
}

export interface RestricaoConsiderada {
  auxiliarId: string;
  auxiliarNome: string;
  tipo: string;
  porta?: string | null;
  dia_semana?: number | null;
  data?: string | null;
  motivo?: string | null;
}

export interface ItemRodizioSugerido {
  data: string;
  porta: string;
  periodo?: string | null;
  auxiliarId: string;
  auxiliarNome: string;
  pontuacao: number;
  motivoSelecao: string[];
  portaId?: string;
  bloqueada?: boolean;
}

export interface MetricaEquilibrioAuxiliar {
  auxiliarId: string;
  auxiliarNome: string;
  totalHistorico: number;
  totalNovo: number;
  totalGeral: number;
  mediaGeral: number;
  desvio: number;
  rankEquilibrio: number;
}

export interface AlertaGeracaoRodizio {
  tipo: 'erro' | 'aviso' | 'info';
  codigo: string;
  mensagem: string;
  data?: string;
  porta?: string;
  auxiliarId?: string;
}

export interface ItemPreservado {
  data: string;
  porta: string;
  auxiliarId: string;
  auxiliarNome?: string;
}

export interface EntradaGeracaoRodizio {
  dataInicio: string;
  dataFim: string;
  portas: PortaInfo[];
  periodos?: PeriodoInfo[];
  diasAtivos: string[];
  auxiliares: AuxiliarInfo[];
  restricoes: RestricaoInfo[];
  historicoTravado: HistoricoRodizio[];
  configuracoes?: Partial<ConfiguracaoPesos>;
  itensPreservados?: ItemPreservado[];
}

export interface ResultadoGeracaoRodizio {
  itens: ItemRodizioSugerido[];
  alertas: AlertaGeracaoRodizio[];
  metricas: MetricaEquilibrioAuxiliar[];
  violacoes: ViolacaoRestricao[];
  restricoesConsideradas: RestricaoConsiderada[];
  resumo: {
    totalItensGerados: number;
    totalAuxiliaresConsideradas: number;
    totalAlertas: number;
    alertasErro: number;
    alertasAviso: number;
    alertasInfo: number;
    usouHistoricoTravado: boolean;
    periodoGerado: {
      dataInicio: string;
      dataFim: string;
    };
  };
}

export const PESOS_DEFAULT: ConfiguracaoPesos = {
  pesoHistorico: 10,
  pesoNovoRodizio: 8,
  pesoRepeticaoPorta: 6,
  pesoSequencia: 5,
  pesoRestricaoEvitar: 4,
  pesoRepeticaoConsecutiva: 8,
  bonusPrefencia: 6,
};