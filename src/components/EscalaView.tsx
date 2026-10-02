import { Printer, RotateCcw, ChevronLeft, ChevronRight, CalendarCheck, Info, AlertCircle, Save, Lock, AlertTriangle, TrendingUp } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { format, getMonth, getYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import logoCCB from '../assets/logo-ccb.png';
import { type ItemEscalaConsolidado } from '../services/rodiziosService';
import * as rodiziosService from '../services/rodiziosService';
import * as auxiliaresService from '../services/auxiliaresService';
import { prepararDadosParaGeracaoRodizio, criarEntradaGeracaoRodizio } from '../domain/prepararGeracaoRodizio';
import { gerarRodizioEquilibrado } from '../domain/gerarRodizioEquilibrado';
import type { RodizioComItens, Auxiliar, Rodizio } from '../types/supabase';
import type { ItemRodizioSugerido, AlertaGeracaoRodizio, MetricaEquilibrioAuxiliar, ViolacaoRestricao, RestricaoConsiderada } from '../types/geracaoRodizio';

const MAPA_PORTA_PARA_LOCAL_ID: Record<string, string> = {
  'entrada': 'l1',
  'galeria': 'l2',
  'lateral': 'l3',
  'sanitario': 'l4',
  'sanitário': 'l4',
  'portaria': 'l1',
  'principal': 'l1',
};

const normalizarPorta = (porta: string): string => {
  if (!porta) return '';
  return porta.toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const normalizarNomeAuxiliar = (nome: string): string => {
  if (!nome) return '';
  return nome.toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

interface SugestaoPreview {
  itens: ItemRodizioSugerido[];
  alertas: AlertaGeracaoRodizio[];
  metricas: MetricaEquilibrioAuxiliar[];
  violacoes: ViolacaoRestricao[];
  restricoesConsideradas: RestricaoConsiderada[];
  rodizioId: string;
  rodizioTitulo: string;
  origem: 'travado' | 'publicado' | 'rascunho';
}

interface LinhaResumo {
  nomeExibicao: string;
  contagemPorLocal: Record<string, number>;
  totalGeral: number;
}

const ORDEM_FIXA_SERVICOS = ['entrada', 'galeria', 'lateral', 'sanitario'];

interface CalendarDay {
  date: Date;
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
}

const getCalendarRows = (month: number, year: number): CalendarDay[][] => {
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Domingo, ..., 6 = Sábado
  
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDays = lastDayOfMonth.getDate();
  
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  
  // Calcular número de semanas necessárias
  const cellsNeeded = startDayOfWeek + totalDays;
  const weeksNeeded = Math.ceil(cellsNeeded / 7);
  
  const days: CalendarDay[] = [];
  
  // Dias do mês anterior
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dateObj = new Date(year, month - 1, dayNum);
    days.push({
      date: dateObj,
      dateStr: format(dateObj, 'yyyy-MM-dd'),
      dayNumber: dayNum,
      isCurrentMonth: false
    });
  }
  
  // Dias do mês atual
  for (let i = 1; i <= totalDays; i++) {
    const dateObj = new Date(year, month, i);
    days.push({
      date: dateObj,
      dateStr: format(dateObj, 'yyyy-MM-dd'),
      dayNumber: i,
      isCurrentMonth: true
    });
  }
  
  // Dias do próximo mês (completar semanas necessárias)
  const totalCells = weeksNeeded * 7;
  const nextMonthPaddingCount = totalCells - days.length;
  for (let i = 1; i <= nextMonthPaddingCount; i++) {
    const dateObj = new Date(year, month + 1, i);
    days.push({
      date: dateObj,
      dateStr: format(dateObj, 'yyyy-MM-dd'),
      dayNumber: i,
      isCurrentMonth: false
    });
  }
  
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  
  return weeks;
};

export function EscalaView() {
  const { 
    colaboradoras, 
    locais, 
    escalas, 
    setEscalas, 
    localidade,
    dataAlvo: dataAlvoISO,
    setDataAlvo,
  } = useStore();
  
  const [carregandoSupabase, setCarregandoSupabase] = useState(false);
  const [erroSupabase, setErroSupabase] = useState<string | null>(null);
  const [itemSupabase, setItemSupabase] = useState<RodizioComItens | null>(null);
  const [auxiliaresSupabase, setAuxiliaresSupabase] = useState<Record<string, string>>({});
  const [origemEscala, setOrigemEscala] = useState<string | null>(null);
  const [infoOrigem, setInfoOrigem] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [previewSugestao, setPreviewSugestao] = useState<SugestaoPreview | null>(null);
  const [salvandoSugestao, setSalvandoSugestao] = useState(false);
  const [erroRecalcular, setErroRecalcular] = useState<string | null>(null);
  
  const dataAlvo = useMemo(() => parseISO(dataAlvoISO), [dataAlvoISO]);
  
  const mesAtual = getMonth(dataAlvo);
  const anoAtual = getYear(dataAlvo);

  const carregarDoSupabase = useCallback(async () => {
    setCarregandoSupabase(true);
    setErroSupabase(null);
    setOrigemEscala(null);
    setItemSupabase(null);
    
    const resultado = await rodiziosService.buscarEscalaMensalConsolidada(anoAtual, mesAtual + 1);
    
    if (resultado.error) {
      setErroSupabase(resultado.error);
      setCarregandoSupabase(false);
      return;
    }

    if (resultado.data) {
      
      const novoMapaNomes: Record<string, string> = {};
      resultado.data.itensConsolidados.forEach((item: ItemEscalaConsolidado) => {
        novoMapaNomes[item.auxiliarId] = item.auxiliarNome;
      });
      
      const resAuxiliares = await auxiliaresService.listarAuxiliares();
      if (resAuxiliares.data) {
        resAuxiliares.data.forEach((a: Auxiliar) => {
          novoMapaNomes[a.id] = a.nome;
        });
      }
      setAuxiliaresSupabase(novoMapaNomes);

      const mesAnoLabel = format(new Date(anoAtual, mesAtual, 1), 'MMMM/yyyy', { locale: ptBR });
      const statusLabel = resultado.data.rodizioOficial?.status === 'travado' ? 'Travado' : 'Publicado';
      const totalOficial = resultado.data.totalItensOficial;
      const totalHistorico = resultado.data.totalItensHistorico;
      const totalConsolidado = resultado.data.totalConsolidado;
      
      if (totalHistorico > 0) {
        setInfoOrigem(`${mesAnoLabel.charAt(0).toUpperCase() + mesAnoLabel.slice(1)} — ${statusLabel} — ${totalConsolidado} itens (${totalOficial} oficial + ${totalHistorico} histórico)`);
      } else {
        setInfoOrigem(`${mesAnoLabel.charAt(0).toUpperCase() + mesAnoLabel.slice(1)} — ${statusLabel} — ${totalConsolidado} itens`);
      }
      
      if (resultado.data.rodizioOficial) {
        setItemSupabase({
          rodizio: resultado.data.rodizioOficial,
          itens: []
        });
      }

      setOrigemEscala('supabase');
      
      const itensConvertidos = resultado.data.itensConsolidados
        .map((item: ItemEscalaConsolidado) => {
          const portaNormalizada = normalizarPorta(item.porta);
          let localId = MAPA_PORTA_PARA_LOCAL_ID[portaNormalizada];
          
          // Tenta encontrar por nome nos locais atuais caso o mapeamento direto falhe
          if (!localId) {
            const localCorrespondente = locais.find(l => normalizarPorta(l.nome) === portaNormalizada);
            localId = localCorrespondente?.id || item.porta;
          }
          
          return {
            id: `${item.data}-${item.porta}-${item.auxiliarId}`,
            data: item.data,
            localId,
            colaboradoraId: item.auxiliarId,
            turno: null,
          };
        });
      
      setEscalas(itensConvertidos);
    } else {
      setEscalas([]);
    }
    
    setCarregandoSupabase(false);
  }, [anoAtual, mesAtual, setEscalas, locais]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      await carregarDoSupabase();
    };
    load();
    return () => { mounted = false; };
  }, [carregarDoSupabase]);

  const handleGerar = async () => {
    const primeiroDia = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const ultimoDiaStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    
    if (itemSupabase?.rodizio.travado) {
      setErroRecalcular('Este rodízio está travado e não pode ser recalculado. Vá para a tela Rodízios para criar um novo rascunho.');
      return;
    }
    
    const rascunhoResult = await rodiziosService.listarRodizios();
    const rascunho = rascunhoResult.data?.find((r: Rodizio) => 
      r.status === 'rascunho' && 
      !r.travado &&
      r.data_inicio <= ultimoDiaStr &&
      r.data_fim >= primeiroDia
    );
    
    if (!rascunho && !itemSupabase) {
      setErroRecalcular('Crie um novo rodízio em Rodízios para poder recalcular a escala.');
      return;
    }
    
    setRecalculando(true);
    setErroRecalcular(null);
    
    try {
      const dados = await prepararDadosParaGeracaoRodizio();
      
      if (dados.erro) {
        setErroRecalcular(dados.erro);
        setRecalculando(false);
        return;
      }
      
      // Preservar escalas anteriores à data de hoje
      const hojeStr = format(new Date(), 'yyyy-MM-dd');
      const itensPreservados = escalas
        .filter(item => item.data < hojeStr)
        .map(item => {
          const colaborador = colaboradoras.find(c => c.id === item.colaboradoraId);
          const auxiliarNome = colaborador?.nome || 'Preservada';
          const local = locais.find(l => l.id === item.localId);
          const localNome = local?.nome || item.localId;
          return {
            data: item.data,
            porta: localNome,
            auxiliarId: item.colaboradoraId,
            auxiliarNome,
          };
        });

      const entrada = {
        ...criarEntradaGeracaoRodizio(dados, primeiroDia, ultimoDiaStr),
        itensPreservados,
      };
      const resultado = gerarRodizioEquilibrado(entrada);
      
      if (resultado.itens.length === 0) {
        setErroRecalcular('Não foi possível gerar itens. Verifique auxiliares ativas e portas configuradas.');
        setRecalculando(false);
        return;
      }
      
      setPreviewSugestao({
        itens: resultado.itens,
        alertas: resultado.alertas,
        metricas: resultado.metricas,
        violacoes: resultado.violacoes,
        restricoesConsideradas: resultado.restricoesConsideradas,
        rodizioId: itemSupabase?.rodizio.id || rascunho?.id || '',
        rodizioTitulo: itemSupabase?.rodizio.titulo || rascunho?.titulo || 'Escala Mensal',
        origem: 'rascunho',
      });
      
    } catch {
      setErroRecalcular('Erro ao gerar sugestão de equilíbrio.');
    }
    
    setRecalculando(false);
  };

  const handleSalvarSugestao = async () => {
    if (!previewSugestao) return;

    setSalvandoSugestao(true);
    try {
      const itensParaSalvar = previewSugestao.itens.map(item => ({
        data: item.data,
        porta: item.porta,
        periodo: item.periodo || null,
        auxiliar_id: item.auxiliarId,
        observacoes: item.motivoSelecao.length > 0 ? item.motivoSelecao.join('; ') : null,
      }));

      const result = await rodiziosService.salvarItensRodizio(previewSugestao.rodizioId, itensParaSalvar);

      if (result.error) {
        setErroRecalcular('Erro ao salvar sugestão: ' + result.error);
      } else {
        await carregarDoSupabase();
        setPreviewSugestao(null);
      }
    } catch {
      setErroRecalcular('Erro ao salvar sugestão.');
    }
    setSalvandoSugestao(false);
  };

  const mudarMes = (delta: number) => {
    const nova = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth() + delta, 1);
    setDataAlvo(nova.toISOString());
    setErroRecalcular(null);
  };

  const escalaPorData = useMemo(() => {
    const agrupado: Record<string, Record<string, string>> = {};
    escalas.forEach(t => {
      if (!agrupado[t.data]) agrupado[t.data] = {};
      
      const nomeStore = colaboradoras.find(c => c.id === t.colaboradoraId)?.nome;
      const nomeSupabase = auxiliaresSupabase[t.colaboradoraId];
      
      agrupado[t.data][t.localId] = nomeStore || nomeSupabase || '-';
    });
    return agrupado;
  }, [escalas, colaboradoras, auxiliaresSupabase]);

  const getEscalaOrdenadaParaDia = useCallback((dataStr: string) => {
    const escalaDia = escalaPorData[dataStr];
    if (!escalaDia) return [];

    const locaisOrdenados = [...locais].sort((a, b) => {
      const normA = normalizarPorta(a.nome);
      const normB = normalizarPorta(b.nome);
      
      const idxA = ORDEM_FIXA_SERVICOS.indexOf(normA);
      const idxB = ORDEM_FIXA_SERVICOS.indexOf(normB);
      
      const posA = idxA === -1 ? 99 : idxA;
      const posB = idxB === -1 ? 99 : idxB;
      return posA - posB;
    });

    return locaisOrdenados
      .map(l => {
        const auxiliarNome = escalaDia[l.id];
        if (auxiliarNome && auxiliarNome !== '-') {
          return {
            localNome: l.nome,
            auxiliarNome
          };
        }
        return null;
      })
      .filter(Boolean) as { localNome: string; auxiliarNome: string }[];
  }, [escalaPorData, locais]);

  const weeks = useMemo(() => getCalendarRows(mesAtual, anoAtual), [mesAtual, anoAtual]);

  const resumo = useMemo(() => {
    const mapaResumo = new Map<string, LinhaResumo>();
    
    // Função auxiliar para inicializar ou obter linha do mapa
    const obterOuCriarLinha = (nome: string): LinhaResumo => {
      const nomeNormalizado = normalizarNomeAuxiliar(nome);
      if (!mapaResumo.has(nomeNormalizado)) {
        const novaLinha: LinhaResumo = {
          nomeExibicao: nome,
          contagemPorLocal: {},
          totalGeral: 0
        };
        locais.forEach(l => { novaLinha.contagemPorLocal[l.id] = 0; });
        mapaResumo.set(nomeNormalizado, novaLinha);
      }
      return mapaResumo.get(nomeNormalizado)!;
    };

    // 1. Processar itens consolidados (Supabase)
    escalas.forEach(item => {
      const nomeStore = colaboradoras.find(c => c.id === item.colaboradoraId)?.nome;
      const nomeSupabase = auxiliaresSupabase[item.colaboradoraId];
      const nome = nomeStore || nomeSupabase;
      
      if (nome) {
        const linha = obterOuCriarLinha(nome);
        linha.contagemPorLocal[item.localId] = (linha.contagemPorLocal[item.localId] || 0) + 1;
        linha.totalGeral += 1;
      }
    });

    // 2. Garantir que todas as auxiliares da store apareçam (mesmo que zeradas) sem duplicar por nome
    colaboradoras.forEach(c => {
      obterOuCriarLinha(c.nome);
    });

    // Converter para array e ordenar por nome
    const resultado = Array.from(mapaResumo.values()).sort((a, b) => 
      a.nomeExibicao.localeCompare(b.nomeExibicao)
    );

    const totalItensConsolidados = escalas.length;
    const totalGeralResumo = resultado.reduce((acc, curr) => acc + curr.totalGeral, 0);

    console.debug("[EscalaView] total itens consolidados:", totalItensConsolidados);
    console.debug("[EscalaView] total geral resumo:", totalGeralResumo);
    console.debug("[EscalaView] linhas resumo:", resultado.length);

    return resultado;
  }, [escalas, colaboradoras, locais, auxiliaresSupabase]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 print-container print:space-y-4">
      
      {/* Header p/ Impressão / Visual */}
      <header className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 relative overflow-hidden print-header-compact">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none no-print">
           <CalendarCheck className="w-64 h-64 -mr-16 -mt-16" />
        </div>
        
        <div className="flex flex-row justify-between items-center gap-4 relative z-10 w-full border-b border-slate-200 pb-6 print:pb-2">
          {/* Lado Esquerdo: Logotipo */}
          <div className="flex-1 flex justify-start">
            <div className="border border-slate-800 p-1.5 rounded-sm bg-white print:p-0.5">
              <img src={logoCCB} alt="CCB" className="h-10 w-auto object-contain print:h-8" />
            </div>
          </div>
          
          {/* Centro: Localidade */}
          <div className="flex-1 text-center">
            <p className="text-2xl sm:text-3xl font-black text-[#1e40af] tracking-widest uppercase print:text-lg">
              {localidade}
            </p>
          </div>
          
          {/* Lado Direito: Mês e Ano */}
          <div className="flex-1 text-right">
            <h1 className="text-2xl sm:text-3xl font-black text-[#1e40af] capitalize tracking-tight print:text-lg">
              {format(dataAlvo, 'MMMM \'de\' yyyy', { locale: ptBR })}
            </h1>
          </div>
        </div>

        {/* Metadata badges for system feedback (non-print) */}
        <div className="mt-4 flex flex-wrap gap-2 justify-end text-xs no-print">
          {carregandoSupabase && (
            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
              <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
              Carregando do Supabase...
            </span>
          )}
          {erroSupabase && (
            <span className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {erroSupabase}
            </span>
          )}
          {origemEscala === 'travado' && (
            <span className="bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-semibold">
              <Lock className="w-3.5 h-3.5" />
              Escala Travada
            </span>
          )}
          {infoOrigem && (
            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono">
              Origem: {infoOrigem}
            </span>
          )}
          {origemEscala === 'supabase' && !carregandoSupabase && (
            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-semibold">
              ✓ Supabase
            </span>
          )}
          {origemEscala === 'rascunho' && !carregandoSupabase && (
            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full font-semibold">
              ✓ Rascunho
            </span>
          )}
          {origemEscala === null && !carregandoSupabase && escalas.length === 0 && (
            <span className="bg-slate-50 text-slate-400 px-2.5 py-1 rounded-full">
              Sem rodízio salvo
            </span>
          )}
        </div>

        {erroRecalcular && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{erroRecalcular}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3 no-print">
          <div className="flex items-center bg-slate-100 rounded-2xl p-1">
             <button onClick={() => mudarMes(-1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-slate-600"/></button>
             <span className="px-4 font-bold text-slate-700 text-sm">Navegar Mês</span>
             <button onClick={() => mudarMes(1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-slate-600"/></button>
          </div>
          <button onClick={handleGerar} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Recalcular Escala
          </button>
          <button onClick={() => window.print()} className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </header>

      {/* Grid Table */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-800 overflow-hidden print:border-slate-800">
        <div className="overflow-x-auto">
          <table className="calendar-table w-full text-center border-collapse border border-slate-800">
            <thead>
              <tr className="bg-[#0b2c5c] text-white print:bg-[#0b2c5c]">
                <th className="px-3 py-4 text-xs font-black uppercase tracking-[0.2em] border border-slate-800 text-white w-1/7">Domingo</th>
                <th className="px-3 py-4 text-xs font-black uppercase tracking-[0.2em] border border-slate-800 text-white w-1/7">Segunda-Feira</th>
                <th className="px-3 py-4 text-xs font-black uppercase tracking-[0.2em] border border-slate-800 text-white w-1/7">Terça-Feira</th>
                <th className="px-3 py-4 text-xs font-black uppercase tracking-[0.2em] border border-slate-800 text-white w-1/7">Quarta-Feira</th>
                <th className="px-3 py-4 text-xs font-black uppercase tracking-[0.2em] border border-slate-800 text-white w-1/7">Quinta-Feira</th>
                <th className="px-3 py-4 text-xs font-black uppercase tracking-[0.2em] border border-slate-800 text-white w-1/7">Sexta-Feira</th>
                <th className="px-3 py-4 text-xs font-black uppercase tracking-[0.2em] border border-slate-800 text-white w-1/7">Sábado</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIdx) => {
                const isWeek6 = weekIdx === 5;
                const hasCurrentMonthDaysInWeek6Cols2To6 = isWeek6
                  ? week.slice(2).some(d => d.isCurrentMonth)
                  : false;

                if (isWeek6 && !hasCurrentMonthDaysInWeek6Cols2To6) {
                  // Renderiza apenas os 2 primeiros dias (Domingo e Segunda)
                  // e o resto mesclado para Observações
                  return (
                    <tr key={weekIdx} className="h-28 print:h-auto">
                      {week.slice(0, 2).map(day => {
                        const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                        const escalaDia = day.isCurrentMonth ? getEscalaOrdenadaParaDia(day.dateStr) : [];
                        return (
                          <td
                            key={day.dateStr}
                            className={cn(
                              "calendar-cell border border-slate-800 p-2 align-top text-left relative transition-colors h-28 print:h-auto w-1/7",
                              isWeekend ? "bg-slate-100/60" : "bg-white",
                              !day.isCurrentMonth && "bg-slate-50/50"
                            )}
                          >
                            <span
                              className={cn(
                                "font-bold text-xs absolute top-1 left-2 select-none",
                                day.isCurrentMonth ? "text-slate-900" : "text-slate-400"
                              )}
                            >
                              {day.dayNumber}
                            </span>
                            {day.isCurrentMonth && escalaDia.length > 0 && (
                              <div className="mt-5 flex flex-col items-center justify-center gap-1 w-full text-center">
                                {escalaDia.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[10px] sm:text-xs font-bold text-slate-800 leading-tight"
                                  >
                                    {item.localNome} - {item.auxiliarNome}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td
                        colSpan={5}
                        className="calendar-cell p-3 border border-slate-800 text-left align-top bg-white relative h-28 print:h-auto"
                      >
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">Observações:</span>
                        <p className="mt-1 text-slate-800 text-[10px] sm:text-xs font-semibold leading-relaxed">
                          Ensaios: Sábados às 17hs. Nos dias de ensaio é necessário o apoio de todos os que estiverem disponíveis. Deus abençoe!
                        </p>
                      </td>
                    </tr>
                  );
                }

                // Linha normal de semana
                return (
                  <tr key={weekIdx} className="h-28 print:h-auto">
                    {week.map(day => {
                      const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                      const escalaDia = day.isCurrentMonth ? getEscalaOrdenadaParaDia(day.dateStr) : [];
                      return (
                        <td
                          key={day.dateStr}
                          className={cn(
                            "calendar-cell border border-slate-800 p-2 align-top text-left relative transition-colors h-28 print:h-auto w-1/7",
                            isWeekend ? "bg-slate-100/60" : "bg-white",
                            !day.isCurrentMonth && "bg-slate-50/50"
                          )}
                        >
                          <span
                            className={cn(
                              "font-bold text-xs absolute top-1 left-2 select-none",
                              day.isCurrentMonth ? "text-slate-900" : "text-slate-400"
                            )}
                          >
                            {day.dayNumber}
                          </span>
                          {day.isCurrentMonth && escalaDia.length > 0 && (
                            <div className="mt-5 flex flex-col items-center justify-center gap-1 w-full text-center">
                              {escalaDia.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="text-[10px] sm:text-xs font-bold text-slate-800 leading-tight"
                                >
                                  {item.localNome} - {item.auxiliarNome}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Se o calendário tem menos de 6 semanas ou a 6ª semana foi renderizada por completo (tinha dias válidos em Ter-Sab),
                  então adicionamos a linha de Observações extra abaixo */}
              {(weeks.length < 6 || (weeks.length > 5 && weeks[5].slice(2).some(d => d.isCurrentMonth))) && (
                <tr>
                  <td
                    colSpan={7}
                    className="calendar-cell p-3 border border-slate-800 text-left align-top bg-white relative h-20 print:h-auto"
                  >
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">Observações:</span>
                    <p className="mt-1 text-slate-800 text-[10px] sm:text-xs font-semibold leading-relaxed">
                      Ensaios: Sábados às 17hs. Nos dias de ensaio é necessário o apoio de todos os que estiverem disponíveis. Deus abençoe!
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quadro Resumo */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden no-print">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Quadro Resumo de Atividades (Mês)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Colaboradora</th>
                {locais.map(l => (
                  <th key={l.id} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-l border-slate-200">
                    {l.nome}
                  </th>
                ))}
                <th className="px-6 py-4 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center border-l border-slate-200 bg-blue-50/50 print:bg-transparent print:text-slate-800">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resumo.map((linha) => (
                <tr key={linha.nomeExibicao} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                  <td className="px-6 py-4 text-left font-medium text-slate-700">{linha.nomeExibicao}</td>
                  {locais.map(l => (
                    <td key={l.id} className="px-6 py-4 text-center text-slate-600 border-l border-slate-100">
                      {linha.contagemPorLocal[l.id] || 0}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-center font-bold text-indigo-600 border-l border-slate-100 bg-indigo-50/30 print:bg-transparent print:text-slate-900">
                    {linha.totalGeral}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer Info / Legend */}
      <footer className="grid md:grid-cols-2 gap-8 no-print">
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8 flex gap-5 items-start">
           <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-amber-600" />
           </div>
           <div>
              <h3 className="text-amber-900 font-black uppercase text-sm tracking-widest mb-2">Observações do Algoritmo</h3>
              <ul className="text-sm text-amber-800/80 space-y-2 font-medium">
                <li>• Respeita as restrições individuais de dia da semana (ex: Bruna Gasque 🚫 Terça).</li>
                <li>• Respeita as restrições de local (ex: Sanitário atende requisitos específicos).</li>
                <li>• Considera o histórico realizado no equilíbrio.</li>
                <li>• Implementa rotação automática para evitar repetir o mesmo local consecutivamente.</li>
              </ul>
           </div>
        </div>

        <div className="bg-blue-600 rounded-3xl p-8 text-white flex flex-col justify-between shadow-xl shadow-blue-200">
           <div>
              <h3 className="font-black h3 uppercase text-sm tracking-widest mb-2 opacity-80">Ações de Fechamento</h3>
              <p className="text-sm font-semibold opacity-90 leading-relaxed">
                {origemEscala === 'travado' 
                  ? 'Este rodízio está travado e não pode ser alterado.'
                  : 'Use "Recalcular Escala" para gerar uma nova sugestão.'}
              </p>
           </div>
           {origemEscala !== 'travado' && (
             <button onClick={handleGerar} disabled={recalculando} className="mt-6 w-full bg-white text-blue-700 font-black py-4 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
               {recalculando ? (
                 <>
                   <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                   Gerando...
                 </>
               ) : (
                 <>
                   <RotateCcw className="w-5 h-5" /> Recalcular Escala
                 </>
               )}
             </button>
           )}
        </div>
      </footer>

      {/* Preview Modal */}
      {previewSugestao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6" />
                <h2 className="text-xl font-bold">Sugestão Equilibrada</h2>
              </div>
              <button
                onClick={() => setPreviewSugestao(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Rodízio</p>
                  <p className="font-bold text-slate-800">{previewSugestao.rodizioTitulo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total de itens</p>
                  <p className="font-bold text-2xl text-blue-600">{previewSugestao.itens.length}</p>
                </div>
              </div>

              {previewSugestao.alertas.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <p className="font-semibold text-amber-800">Alertas ({previewSugestao.alertas.length})</p>
                  </div>
                  <ul className="space-y-1">
                    {previewSugestao.alertas.map((alerta, idx) => (
                      <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                        <span className="font-mono text-xs bg-amber-100 px-1 rounded">{alerta.tipo}</span>
                        {alerta.mensagem}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previewSugestao.restricoesConsideradas.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-purple-600" />
                    <p className="font-semibold text-purple-800">Restrições Consideradas ({previewSugestao.restricoesConsideradas.length})</p>
                  </div>
                  <div className="space-y-2">
                    {previewSugestao.restricoesConsideradas.slice(0, 5).map((restricao, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-purple-100 text-sm">
                        <span className="font-medium text-slate-800">{restricao.auxiliarNome}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                          restricao.tipo === 'indisponivel' ? 'bg-red-100 text-red-700' :
                          restricao.tipo === 'evitar' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {restricao.tipo}
                        </span>
                        {restricao.porta && <span className="text-xs text-slate-500 ml-2">Porta: {restricao.porta}</span>}
                      </div>
                    ))}
                    {previewSugestao.restricoesConsideradas.length > 5 && (
                      <p className="text-xs text-slate-500">... e mais {previewSugestao.restricoesConsideradas.length - 5} restrições</p>
                    )}
                  </div>
                </div>
              )}

              {previewSugestao.violacoes.length > 0 && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <p className="font-bold text-red-800 text-lg">Violações de Restrição ({previewSugestao.violacoes.length})</p>
                  </div>
                  <p className="text-sm text-red-700 mb-3">
                    Existem restrições <strong>indisponíveis</strong> violadas. Ajuste as restrições ou gere novamente.
                  </p>
                  <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-red-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Data</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Porta</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Auxiliar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {previewSugestao.violacoes.map((violacao, idx) => (
                          <tr key={idx} className="bg-red-50">
                            <td className="px-3 py-2 font-medium text-slate-800">{violacao.data}</td>
                            <td className="px-3 py-2 text-slate-600">{violacao.porta}</td>
                            <td className="px-3 py-2 font-bold text-red-700">{violacao.auxiliar}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <p className="font-semibold text-slate-800 mb-3">Itens Sugeridos</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Data</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Porta</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Auxiliar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewSugestao.itens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {format(parseISO(item.data), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.porta}</td>
                          <td className="px-4 py-3 font-medium text-blue-700">{item.auxiliarNome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setPreviewSugestao(null)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarSugestao}
                  disabled={salvandoSugestao || previewSugestao.violacoes.length > 0}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={previewSugestao.violacoes.length > 0 ? 'Não é possível salvar com violações de restrição' : ''}
                >
                  {salvandoSugestao ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : previewSugestao.violacoes.length > 0 ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      Violações Impedem Salvamento
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Sugestão
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
