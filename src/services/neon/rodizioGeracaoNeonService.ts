/**
 * @file rodizioGeracaoNeonService.ts
 * @description P1 - Serviço de geração de escalas para Neon
 *
 * Reutiliza o algoritmo gerarRodizioEquilibrado existente,
 * aplicando-o sobre dados Neon (auxiliares, restrições, histórico).
 * Preparação para salvamento via RPC SQL 06 (substituirItensNeonEditor).
 *
 * Sem persistência direta; apenas calcula sugestão em memória.
 */

import { gerarRodizioEquilibrado } from '../../domain/gerarRodizioEquilibrado';
import type {
  EntradaGeracaoRodizio,
  ItemRodizioSugerido,
  AlertaGeracaoRodizio,
  MetricaEquilibrioAuxiliar,
  ViolacaoRestricao,
  RestricaoConsiderada,
} from '../../types/geracaoRodizio';
import type { Auxiliar, RestricaoAuxiliar, Rodizio, RodizioItem } from '../../types/supabase';

export interface SugestaoGeracaoNeon {
  itens: ItemRodizioSugerido[];
  alertas: AlertaGeracaoRodizio[];
  metricas: MetricaEquilibrioAuxiliar[];
  violacoes: ViolacaoRestricao[];
  restricoesConsideradas: RestricaoConsiderada[];
  rodizioId: string;
  rodizioTitulo: string;
}

export interface DadosGeracaoNeon {
  rodizio: Rodizio;
  auxiliares: Auxiliar[];
  restricoes: RestricaoAuxiliar[];
  itensExistentes?: RodizioItem[];
  historicoTravado?: Array<{ id: string; titulo?: string; itens?: unknown[] }>;
}

/**
 * Gera sugestão de itens para um rodízio Neon
 * usando o algoritmo de equilíbrio existente.
 */
export function gerarSugestaoRodizioNeon(dados: DadosGeracaoNeon): SugestaoGeracaoNeon {
  // Configurar entrada para o gerador
  const entrada: EntradaGeracaoRodizio = {
    dataInicio: dados.rodizio.data_inicio,
    dataFim: dados.rodizio.data_fim,
    portas: ['1', '2'].map((id) => ({ id, nome: `Porta ${id}` })),
    diasAtivos: ['1', '2', '3', '4', '5'],
    auxiliares: dados.auxiliares.map((a) => ({
      id: a.id,
      nome: a.nome,
      ativa: a.ativa,
    })),
    restricoes: dados.restricoes.map((r) => ({
      id: r.id,
      auxiliarId: r.auxiliar_id,
      data: r.data,
      dia_semana: r.dia_semana,
      porta: r.porta,
      tipo: (r.tipo as 'indisponivel' | 'preferencia' | 'evitar' | 'observacao') || 'observacao',
      motivo: r.motivo,
      ativa: r.ativa,
    })),
    historicoTravado: (dados.historicoTravado || []).map((h) => ({
      id: h.id,
      titulo: h.titulo || 'Histórico',
      dataInicio: dados.rodizio.data_inicio,
      dataFim: dados.rodizio.data_fim,
      itens: [],
    })),
  };

  const resultado = gerarRodizioEquilibrado(entrada);

  return {
    itens: resultado.itens,
    alertas: resultado.alertas,
    metricas: resultado.metricas,
    violacoes: resultado.violacoes,
    restricoesConsideradas: resultado.restricoesConsideradas,
    rodizioId: dados.rodizio.id,
    rodizioTitulo: dados.rodizio.titulo,
  };
}

/**
 * Converte sugestão gerada em itens prontos para a RPC
 */
export function converterSugestaoParaItensRpc(
  sugestao: SugestaoGeracaoNeon
): Array<{
  data: string;
  porta: string;
  periodo: string | null;
  auxiliar_id: string;
  observacoes: string | null;
}> {
  return sugestao.itens.map((item) => ({
    data: item.data,
    porta: item.porta,
    periodo: item.periodo || null,
    auxiliar_id: item.auxiliarId,
    observacoes: item.motivoSelecao.length > 0 ? item.motivoSelecao.join('; ') : null,
  }));
}

/**
 * Calcula estatísticas de qualidade da sugestão
 */
export function calcularQualidadeSugestao(sugestao: SugestaoGeracaoNeon): {
  totalItens: number;
  alertasCount: number;
  violacoesCount: number;
  equilibrio: number;
} {
  const totalItens = sugestao.itens.length;
  const alertasCount = sugestao.alertas.length;
  const violacoesCount = sugestao.violacoes.length;

  // Equilibrio é baseado na dispersão de carga entre auxiliares
  const cargas = new Map<string, number>();
  sugestao.itens.forEach((item) => {
    cargas.set(item.auxiliarId, (cargas.get(item.auxiliarId) || 0) + 1);
  });

  let equilibrio = 0;
  if (cargas.size > 0) {
    const valores = Array.from(cargas.values());
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const variancia =
      valores.reduce((sum, v) => sum + Math.pow(v - media, 2), 0) / valores.length;
    const desvio = Math.sqrt(variancia);

    // Equilibrio: 100 = perfeito (desvio 0), 0 = totalmente desigual
    // Usando escala: eq = 100 - min(100, desvio * 10)
    equilibrio = Math.max(0, 100 - desvio * 10);
  }

  return { totalItens, alertasCount, violacoesCount, equilibrio };
}
