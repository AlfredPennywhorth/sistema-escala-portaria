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
  HistoricoRodizio,
  ItemRodizioSugerido,
  AlertaGeracaoRodizio,
  MetricaEquilibrioAuxiliar,
  ViolacaoRestricao,
  RestricaoConsiderada,
} from '../../types/geracaoRodizio';
import type { Auxiliar, RestricaoAuxiliar, Rodizio, RodizioItem, ServiceResult } from '../../types/supabase';

export interface SugestaoGeracaoNeon {
  itens: ItemRodizioSugerido[];
  alertas: AlertaGeracaoRodizio[];
  metricas: MetricaEquilibrioAuxiliar[];
  violacoes: ViolacaoRestricao[];
  restricoesConsideradas: RestricaoConsiderada[];
  rodizioId: string;
  rodizioTitulo: string;
}

import { listarAuxiliares } from './auxiliaresService';
import { listarRestricoesAtivas } from './restricoesService';
import { listarRodiziosAdministrativosNeonHml, obterRodizioComItensNeonHml } from './rodizioFunctionalHmlService';
import { obterUsuarioAtual, obterPerfilUsuarioAtual } from './authService';

export const PORTAS_GERACAO_NEON = [
  { id: 'l1', nome: 'Entrada' }, { id: 'l2', nome: 'Galeria' },
  { id: 'l3', nome: 'Lateral' }, { id: 'l4', nome: 'Sanitário' },
];
export const DIAS_GERACAO_NEON = ['Domingo', 'Terça-Feira', 'Sábado'];

export interface DadosGeracaoNeon {
  rodizio: Rodizio;
  auxiliares: Auxiliar[];
  restricoes: RestricaoAuxiliar[];
  itensExistentes?: RodizioItem[];
  historicoTravado: HistoricoRodizio[];
}

/**
 * Gera sugestão de itens para um rodízio Neon
 * usando o algoritmo de equilíbrio existente.
 */
export function gerarSugestaoRodizioNeon(dados: DadosGeracaoNeon): SugestaoGeracaoNeon {
  if (!dados.auxiliares.some(a => a.ativa)) throw new Error('Nenhuma auxiliar ativa disponível.');
  if (dados.rodizio.status !== 'rascunho' || dados.rodizio.travado) throw new Error('Geração restrita a rascunhos não travados.');
  // Configurar entrada para o gerador
  const entrada: EntradaGeracaoRodizio = {
    dataInicio: dados.rodizio.data_inicio,
    dataFim: dados.rodizio.data_fim,
    portas: PORTAS_GERACAO_NEON,
    diasAtivos: DIAS_GERACAO_NEON,
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
    historicoTravado: dados.historicoTravado,
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

/** Consultas administrativas limitadas; falhas não são convertidas em listas vazias. */
export async function carregarDadosGeracaoNeon(rodizio: Rodizio): Promise<ServiceResult<DadosGeracaoNeon>> {
  try {
    const usuario = await obterUsuarioAtual();
    const perfil = await obterPerfilUsuarioAtual();
    if (!usuario.data || usuario.error || perfil.error || perfil.data?.perfil !== 'admin' || perfil.data.user_id !== usuario.data.id) return { data: null, error: 'Sessão administrativa Neon não confirmada.' };
    const [auxiliares, restricoes, escalas] = await Promise.all([listarAuxiliares(false), listarRestricoesAtivas(), listarRodiziosAdministrativosNeonHml()]);
    if (auxiliares.error || restricoes.error || escalas.error || !auxiliares.data || !restricoes.data || !escalas.data) return { data: null, error: 'Não foi possível carregar auxiliares, restrições e histórico completo.' };
    // Evitar gerar com uma resposta que possa ter sido truncada pelo limite REST.
    if (auxiliares.data.length >= 1000 || restricoes.data.length >= 1000) return { data: null, error: 'Limite de leitura atingido; paginação necessária.' };
    const historicoTravado: HistoricoRodizio[] = [];
    for (const escala of escalas.data.filter(r => r.travado && r.id !== rodizio.id)) {
      const detalhe = await obterRodizioComItensNeonHml(escala.id);
      if (detalhe.error || !detalhe.data || !detalhe.data.rodizio.travado) return { data: null, error: 'Histórico travado incompleto ou alterado durante a consulta.' };
      const h = detalhe.data.rodizio;
      historicoTravado.push({ id: h.id, titulo: h.titulo, dataInicio: h.data_inicio, dataFim: h.data_fim,
        itens: detalhe.data.itens.flatMap(i => i.auxiliar_id ? [{ rodizioId: h.id, data: i.data, porta: i.porta, periodo: i.periodo, auxiliarId: i.auxiliar_id }] : []) });
    }
    const fim = await obterUsuarioAtual();
    const perfilFim = await obterPerfilUsuarioAtual();
    if (fim.error || fim.data?.id !== usuario.data.id || perfilFim.error || perfilFim.data?.perfil !== 'admin' || perfilFim.data.user_id !== usuario.data.id) return { data: null, error: 'Sessão alterada durante a leitura.' };
    return { data: { rodizio, auxiliares: auxiliares.data, restricoes: restricoes.data, historicoTravado }, error: null };
  } catch { return { data: null, error: 'Falha ao preparar geração Neon.' }; }
}
