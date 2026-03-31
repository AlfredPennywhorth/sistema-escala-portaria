export type DiaSemana = 'Domingo' | 'Segunda-Feira' | 'Terça-Feira' | 'Quarta-Feira' | 'Quinta-Feira' | 'Sexta-Feira' | 'Sábado';

export interface Restricao {
  dia?: DiaSemana[];
  local?: string[];
}

export interface Colaboradora {
  id: string;
  nome: string;
  restricoes: Restricao;
  cargaAcumulada: number; // Histórico permanente de turnos
}

export interface Local {
  id: string;
  nome: string;
}

export interface Turno {
  id: string;
  data: string; // ISO format YYYY-MM-DD
  localId: string;
  colaboradoraId: string;
}

export interface ConfigEscala {
  localidade: string;
  diasSemanaAtivos: DiaSemana[];
  locais: Local[];
}

export interface HistoricoAcumulado {
  [colaboradoraId: string]: number;
}
