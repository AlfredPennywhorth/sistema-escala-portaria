import {
  startOfDay,
  eachDayOfInterval,
  parseISO,
  format,
  differenceInDays,
} from 'date-fns';
import type {
  EntradaGeracaoRodizio,
  ResultadoGeracaoRodizio,
  ItemRodizioSugerido,
  MetricaEquilibrioAuxiliar,
  AlertaGeracaoRodizio,
  ConfiguracaoPesos,
  HistoricoRodizio,
  RestricaoInfo,
  AuxiliarInfo,
  PortaInfo,
} from '../types/geracaoRodizio';
import { PESOS_DEFAULT } from '../types/geracaoRodizio';

function normalizarTextoComparacao(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function obterDiaSemanaLocal(dataISO: string): number {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}

function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function calcularCargaHistorica(
  auxiliarId: string,
  historico: HistoricoRodizio[]
): number {
  let total = 0;
  for (const rodizio of historico) {
    for (const item of rodizio.itens) {
      if (item.auxiliarId === auxiliarId) {
        total++;
      }
    }
  }
  return total;
}

function calcularCargaNoNovoRodizio(
  auxiliarId: string,
  itensJaGerados: ItemRodizioSugerido[]
): number {
  return itensJaGerados.filter((item) => item.auxiliarId === auxiliarId).length;
}

function contarRepeticoesPorta(
  auxiliarId: string,
  porta: string,
  itensJaGerados: ItemRodizioSugerido[]
): number {
  return itensJaGerados.filter(
    (item) => item.auxiliarId === auxiliarId && item.porta === porta
  ).length;
}

function getUltimaDataTrabalho(
  auxiliarId: string,
  itensJaGerados: ItemRodizioSugerido[]
): string | null {
  const itens = itensJaGerados
    .filter((item) => item.auxiliarId === auxiliarId)
    .sort((a, b) => parseISO(b.data).getTime() - parseISO(a.data).getTime());
  return itens.length > 0 ? itens[0].data : null;
}

function calcularPenalidadeSequencia(
  dataAtual: string,
  ultimaData: string | null,
  pesos: ConfiguracaoPesos
): number {
  if (!ultimaData) return 0;

  const diasDiff = Math.abs(
    differenceInDays(parseISO(dataAtual), parseISO(ultimaData))
  );

  if (diasDiff === 0) {
    return pesos.pesoRepeticaoConsecutiva;
  }
  if (diasDiff === 1) {
    return pesos.pesoSequencia * 0.8;
  }
  if (diasDiff <= 3) {
    return pesos.pesoSequencia * 0.5;
  }
  return 0;
}

function getRestricaoNaData(
  auxiliarId: string,
  data: string,
  porta: string,
  restricoes: RestricaoInfo[]
): RestricaoInfo | undefined {
  const diaSemana = obterDiaSemanaLocal(data);
  const portaNormalizada = normalizarTextoComparacao(porta);
  
  return restricoes.find(r => {
    if (r.auxiliarId !== auxiliarId) return false;
    
    if (!r.ativa && r.ativa !== undefined) return false;
    
    if (r.data && r.data === data) {
      if (r.porta) {
        return normalizarTextoComparacao(r.porta) === portaNormalizada;
      }
      return true;
    }
    
    if (r.dia_semana !== null && r.dia_semana === diaSemana) {
      if (r.porta) {
        return normalizarTextoComparacao(r.porta) === portaNormalizada;
      }
      return true;
    }
    
    if (r.porta && !r.data && r.dia_semana === null) {
      return normalizarTextoComparacao(r.porta) === portaNormalizada;
    }
    
    return false;
  });
}

function calcularPenalidadeRestricao(
  restricao: RestricaoInfo | undefined,
  pesos: ConfiguracaoPesos
): { bloqueada: boolean; penalidade: number; motivo: string } {
  if (!restricao) {
    return { bloqueada: false, penalidade: 0, motivo: '' };
  }

  switch (restricao.tipo) {
    case 'indisponivel':
      return {
        bloqueada: true,
        penalidade: 0,
        motivo: `Bloqueada por restrição: ${restricao.motivo || 'indisponível'}`,
      };
    case 'evitar':
      return {
        bloqueada: false,
        penalidade: pesos.pesoRestricaoEvitar,
        motivo: `Restrição de evitar: ${restricao.motivo || ''}`,
      };
    case 'preferencia':
      return {
        bloqueada: false,
        penalidade: -pesos.bonusPrefencia,
        motivo: `Preferência: ${restricao.motivo || ''}`,
      };
    case 'observacao':
      return {
        bloqueada: false,
        penalidade: 0,
        motivo: `Observação: ${restricao.motivo || ''}`,
      };
    default:
      return { bloqueada: false, penalidade: 0, motivo: '' };
  }
}

function calcularPontuacao(
  auxiliar: AuxiliarInfo,
  data: string,
  porta: string,
  itensJaGerados: ItemRodizioSugerido[],
  cargaHistorica: number,
  restricoes: RestricaoInfo[],
  pesos: ConfiguracaoPesos
): { pontuacao: number; motivos: string[] } {
  const motivos: string[] = [];
  let pontuacao = 0;

  const cargaNovo = calcularCargaNoNovoRodizio(auxiliar.id, itensJaGerados);
  pontuacao += cargaNovo * pesos.pesoNovoRodizio;
  motivos.push(`Carga no novo rodízio: ${cargaNovo} × ${pesos.pesoNovoRodizio} = ${cargaNovo * pesos.pesoNovoRodizio}`);

  pontuacao += cargaHistorica * pesos.pesoHistorico;
  motivos.push(`Carga histórica: ${cargaHistorica} × ${pesos.pesoHistorico} = ${cargaHistorica * pesos.pesoHistorico}`);

  const repeticoesPorta = contarRepeticoesPorta(auxiliar.id, porta, itensJaGerados);
  pontuacao += repeticoesPorta * pesos.pesoRepeticaoPorta;
  if (repeticoesPorta > 0) {
    motivos.push(`Repetição na porta: ${repeticoesPorta} × ${pesos.pesoRepeticaoPorta} = ${repeticoesPorta * pesos.pesoRepeticaoPorta}`);
  }

  const ultimaData = getUltimaDataTrabalho(auxiliar.id, itensJaGerados);
  const penalidadeSequencia = calcularPenalidadeSequencia(data, ultimaData, pesos);
  pontuacao += penalidadeSequencia;
  if (penalidadeSequencia > 0) {
    motivos.push(`Sequência: ${penalidadeSequencia.toFixed(1)}`);
  }

  const restricao = getRestricaoNaData(auxiliar.id, data, porta, restricoes);
  const { bloqueada, penalidade, motivo } = calcularPenalidadeRestricao(restricao, pesos);
  if (bloqueada) {
    return { pontuacao: Infinity, motivos: [motivo] };
  }
  if (penalidade !== 0) {
    pontuacao += penalidade;
    motivos.push(`Restrição (${restricao?.tipo}): ${penalidade > 0 ? '+' : ''}${penalidade}`);
  }

  return { pontuacao, motivos };
}

function gerarAlertas(
  resultado: ItemRodizioSugerido[],
  auxiliares: AuxiliarInfo[],
  historico: HistoricoRodizio[],
  diasDoPeriodo: Date[],
  portas: PortaInfo[]
): AlertaGeracaoRodizio[] {
  const alertas: AlertaGeracaoRodizio[] = [];

  if (historico.length === 0) {
    alertas.push({
      tipo: 'aviso',
      codigo: 'SEM_HISTORICO',
      mensagem:
        'Não há rodízios travados no histórico. O algoritmo usará equilíbrio básico sem referência histórica.',
    });
  }

  const totalEsperado = diasDoPeriodo.length * portas.length;
  const totalGerado = resultado.length;
  const faltantes = totalEsperado - totalGerado;

  if (faltantes > 0) {
    alertas.push({
      tipo: 'erro',
      codigo: 'ITENS_FALTANTES',
      mensagem: `${faltantes} vaga(s) não puderam ser preenchida(s) por falta de auxiliares disponíveis.`,
    });
  }

  if (auxiliares.length === 0) {
    alertas.push({
      tipo: 'erro',
      codigo: 'SEM_AUXILIARES',
      mensagem: 'Não há auxiliares ativas para gerar o rodízio.',
    });
  }

  const auxiliaresSemHistorico = auxiliares.filter(
    (a) => calcularCargaHistorica(a.id, historico) === 0
  );
  if (auxiliaresSemHistorico.length > 0 && historico.length > 0) {
    alertas.push({
      tipo: 'info',
      codigo: 'AUXILIARES_NOVAS',
      mensagem: `${auxiliaresSemHistorico.length} auxiliar(es) sem histórico. Priorizada(s) para equilíbrio.`,
    });
  }

  const itensBloqueados = resultado.filter((item) => item.pontuacao === Infinity);
  if (itensBloqueados.length > 0) {
    const datasBloqueadas = [...new Set(itensBloqueados.map((i) => i.data))];
    alertas.push({
      tipo: 'erro',
      codigo: 'DATAS_BLOQUEADAS',
      mensagem: `${datasBloqueadas.length} data(s) com todas as auxiliares bloqueadas por restrições: ${datasBloqueadas.join(', ')}`,
    });
  }

  const metricas = calcularMetricas(resultado, auxiliares, historico);
  const mediaGeral =
    metricas.length > 0
      ? metricas.reduce((sum, m) => sum + m.totalGeral, 0) / metricas.length
      : 0;

  for (const metrica of metricas) {
    if (metrica.totalGeral > mediaGeral * 1.5) {
      alertas.push({
        tipo: 'aviso',
        codigo: 'Desequilibrio',
        mensagem: `${metrica.auxiliarNome} está com carga ${metrica.totalGeral} acima da média (${mediaGeral.toFixed(1)}). Verificar justificativa.`,
        auxiliarId: metrica.auxiliarId,
      });
    }
  }

  const totalRestricoesEvitar = resultado.filter(
    (item) => item.motivoSelecao.some((m) => m.includes('evitar'))
  ).length;
  if (totalRestricoesEvitar > 0) {
    alertas.push({
      tipo: 'info',
      codigo: 'RESTRICOES_IGNORADAS',
      mensagem: `${totalRestricoesEvitar} escala(s) precisaram ignorar restrição "evitar" por falta de alternativas.`,
    });
  }

  return alertas;
}

function validarViolacoesRestricoes(
  itens: ItemRodizioSugerido[],
  restricoes: RestricaoInfo[]
): { valida: boolean; violacoes: Array<{ data: string; porta: string; auxiliar: string; restricao: string }> } {
  const violacoes: Array<{ data: string; porta: string; auxiliar: string; restricao: string }> = [];
  
  const restricoesIndisponiveis = restricoes.filter(r => r.tipo === 'indisponivel');
  
  for (const item of itens) {
    const restricaoViolada = restricoesIndisponiveis.find(r => {
      if (r.auxiliarId !== item.auxiliarId) return false;
      if (!r.ativa && r.ativa !== undefined) return false;
      
      const diaSemana = obterDiaSemanaLocal(item.data);
      const portaNormalizada = normalizarTextoComparacao(item.porta);
      
      if (r.porta && r.data) {
        return r.data === item.data && normalizarTextoComparacao(r.porta) === portaNormalizada;
      }
      
      if (r.porta && r.dia_semana !== null) {
        return r.dia_semana === diaSemana && normalizarTextoComparacao(r.porta) === portaNormalizada;
      }
      
      if (r.data && !r.porta) {
        return r.data === item.data;
      }
      
      if (r.dia_semana !== null && !r.porta) {
        return r.dia_semana === diaSemana;
      }
      
      if (r.porta && !r.data && r.dia_semana === null) {
        return normalizarTextoComparacao(r.porta) === portaNormalizada;
      }
      
      return false;
    });
    
    if (restricaoViolada) {
      violacoes.push({
        data: item.data,
        porta: item.porta,
        auxiliar: item.auxiliarNome,
        restricao: restricaoViolada.motivo || 'indisponível',
      });
    }
  }
  
  return { valida: violacoes.length === 0, violacoes };
}

function calcularMetricas(
  itens: ItemRodizioSugerido[],
  auxiliares: AuxiliarInfo[],
  historico: HistoricoRodizio[]
): MetricaEquilibrioAuxiliar[] {
  const metricas: MetricaEquilibrioAuxiliar[] = [];

  const totalItens = itens.length;
  const mediaGeral = auxiliares.length > 0 ? totalItens / auxiliares.length : 0;

  for (const auxiliar of auxiliares) {
    const totalHistorico = calcularCargaHistorica(auxiliar.id, historico);
    const totalNovo = calcularCargaNoNovoRodizio(auxiliar.id, itens);
    const totalGeral = totalHistorico + totalNovo;
    const desvio = totalGeral - mediaGeral;

    metricas.push({
      auxiliarId: auxiliar.id,
      auxiliarNome: auxiliar.nome,
      totalHistorico,
      totalNovo,
      totalGeral,
      mediaGeral,
      desvio,
      rankEquilibrio: 0,
    });
  }

  metricas.sort((a, b) => a.totalGeral - b.totalGeral);
  metricas.forEach((m, idx) => {
    m.rankEquilibrio = idx + 1;
  });

  return metricas;
}

export function gerarRodizioEquilibrado(
  input: EntradaGeracaoRodizio
): ResultadoGeracaoRodizio {
  const pesos: ConfiguracaoPesos = {
    ...PESOS_DEFAULT,
    ...input.configuracoes,
  };

  const alertas: AlertaGeracaoRodizio[] = [];
  const itens: ItemRodizioSugerido[] = [];

  if (input.auxiliares.length === 0) {
    alertas.push({
      tipo: 'erro',
      codigo: 'SEM_AUXILIARES',
      mensagem: 'Não há auxiliares ativas para gerar o rodízio.',
    });
    return {
      itens: [],
      alertas,
      metricas: [],
      violacoes: [],
      restricoesConsideradas: [],
      resumo: {
        totalItensGerados: 0,
        totalAuxiliaresConsideradas: 0,
        totalAlertas: alertas.length,
        alertasErro: alertas.filter((a) => a.tipo === 'erro').length,
        alertasAviso: alertas.filter((a) => a.tipo === 'aviso').length,
        alertasInfo: alertas.filter((a) => a.tipo === 'info').length,
        usouHistoricoTravado: input.historicoTravado.length > 0,
        periodoGerado: {
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        },
      },
    };
  }

  const dataInicioDate = parseISO(input.dataInicio);
  const dataFimDate = parseISO(input.dataFim);
  const diasDoPeriodo = eachDayOfInterval({
    start: startOfDay(dataInicioDate),
    end: startOfDay(dataFimDate),
  });

  const diasAtivosSet = new Set(input.diasAtivos);

  const DIAS_NOMES: Record<number, string> = {
    0: 'Domingo',
    1: 'Segunda-Feira',
    2: 'Terça-Feira',
    3: 'Quarta-Feira',
    4: 'Quinta-Feira',
    5: 'Sexta-Feira',
    6: 'Sábado',
  };

  const cargasHistoricas: Record<string, number> = {};
  for (const auxiliar of input.auxiliares) {
    cargasHistoricas[auxiliar.id] = calcularCargaHistorica(
      auxiliar.id,
      input.historicoTravado
    );
  }

  for (const dia of diasDoPeriodo) {
    const dataStr = format(dia, 'yyyy-MM-dd');
    const nomeDia = DIAS_NOMES[dia.getDay()];

    if (!diasAtivosSet.has(nomeDia)) {
      continue;
    }

    const portasDoDia = shuffle([...input.portas]);

    for (const porta of portasDoDia) {
      const candidatas = input.auxiliares
        .filter((a) => a.ativa !== false)
        .map((auxiliar) => {
          const { pontuacao, motivos } = calcularPontuacao(
            auxiliar,
            dataStr,
            porta.nome,
            itens,
            cargasHistoricas[auxiliar.id],
            input.restricoes,
            pesos
          );
          return { auxiliar, pontuacao, motivos };
        })
        .filter((c) => c.pontuacao !== Infinity)
        .sort((a, b) => a.pontuacao - b.pontuacao);

      if (candidatas.length > 0) {
        const selecionada = candidatas[0];
        itens.push({
          data: dataStr,
          porta: porta.nome,
          portaId: porta.id,
          auxiliarId: selecionada.auxiliar.id,
          auxiliarNome: selecionada.auxiliar.nome,
          pontuacao: selecionada.pontuacao,
          motivoSelecao: selecionada.motivos,
        });
        cargasHistoricas[selecionada.auxiliar.id]++;
      } else {
        alertas.push({
          tipo: 'erro',
          codigo: 'SEM_CANDIDATA',
          mensagem: `Nenhuma auxiliar disponível para ${dataStr} - ${porta.nome}.`,
          data: dataStr,
          porta: porta.nome,
        });
      }
    }
  }

  const alertasGerados = gerarAlertas(
    itens,
    input.auxiliares,
    input.historicoTravado,
    diasDoPeriodo,
    input.portas
  );
  alertas.push(...alertasGerados);

  const metricas = calcularMetricas(itens, input.auxiliares, input.historicoTravado);

  const resultadoValidacao = validarViolacoesRestricoes(itens, input.restricoes);
  
  if (!resultadoValidacao.valida) {
    for (const violacao of resultadoValidacao.violacoes) {
      alertas.push({
        tipo: 'erro',
        codigo: 'VIOLACAO_RESTRICAO',
        mensagem: `Violação: ${violacao.auxiliar} não pode atender ${violacao.porta} em ${violacao.data} (${violacao.restricao})`,
        data: violacao.data,
        porta: violacao.porta,
      });
    }
  }

  const restricoesConsideradas = input.restricoes
    .filter(r => r.ativa !== false)
    .map(r => ({
      auxiliarId: r.auxiliarId,
      auxiliarNome: input.auxiliares.find(a => a.id === r.auxiliarId)?.nome || 'Desconhecido',
      tipo: r.tipo,
      porta: r.porta,
      dia_semana: r.dia_semana,
      data: r.data,
      motivo: r.motivo,
    }));

  return {
    itens,
    alertas,
    metricas,
    violacoes: resultadoValidacao.violacoes,
    restricoesConsideradas,
    resumo: {
      totalItensGerados: itens.length,
      totalAuxiliaresConsideradas: input.auxiliares.length,
      totalAlertas: alertas.length,
      alertasErro: alertas.filter((a) => a.tipo === 'erro').length,
      alertasAviso: alertas.filter((a) => a.tipo === 'aviso').length,
      alertasInfo: alertas.filter((a) => a.tipo === 'info').length,
      usouHistoricoTravado: input.historicoTravado.length > 0,
      periodoGerado: {
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
      },
    },
  };
}

export { shuffle, calcularCargaHistorica, calcularMetricas };