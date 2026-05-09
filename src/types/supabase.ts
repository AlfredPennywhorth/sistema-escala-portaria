export type StatusRodizio = 'rascunho' | 'publicado' | 'travado' | 'cancelado';

export type PerfilUsuarioAuxiliar = 'admin' | 'auxiliar' | 'coordenadora';

export type TipoRestricao = 'indisponivel' | 'preferencia' | 'evitar' | 'observacao';

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DIAS_SEMANA: Record<DiaSemana, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export const DIAS_SEMANA_OPCOES: { value: DiaSemana; label: string }[] = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export interface Auxiliar {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  ativa: boolean;
  observacoes: string | null;
  created_at: string;
}

export interface RestricaoAuxiliar {
  id: string;
  auxiliar_id: string;
  data: string | null;
  dia_semana: DiaSemana | null;
  porta: string | null;
  motivo: string | null;
  tipo: TipoRestricao;
  ativa: boolean;
  created_at: string;
}

export interface Rodizio {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  status: StatusRodizio;
  travado: boolean;
  travado_em: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface RodizioItem {
  id: string;
  rodizio_id: string;
  data: string;
  porta: string;
  periodo: string | null;
  auxiliar_id: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface UsuarioAuxiliar {
  id: string;
  user_id: string;
  auxiliar_id: string | null;
  perfil: PerfilUsuarioAuxiliar;
  created_at: string;
}

export interface RodizioComItens {
  rodizio: Rodizio;
  itens: (RodizioItem & { auxiliar?: Auxiliar })[];
}

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export interface AuxiliarInput {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
}

export interface RestricaoInput {
  auxiliar_id: string;
  data?: string | null;
  dia_semana?: number | null;
  porta?: string | null;
  tipo?: TipoRestricao;
  motivo?: string | null;
  ativa?: boolean;
}

export interface RodizioInput {
  titulo: string;
  data_inicio: string;
  data_fim: string;
  observacoes?: string | null;
}

export interface RodizioItemInput {
  data: string;
  porta: string;
  periodo?: string | null;
  auxiliar_id?: string | null;
  observacoes?: string | null;
}

export interface RestricaoFiltros {
  auxiliarId?: string;
  dataInicio?: string;
  dataFim?: string;
  diaSemana?: DiaSemana;
  porta?: string;
  incluirInativas?: boolean;
}