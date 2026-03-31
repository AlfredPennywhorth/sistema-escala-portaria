import { 
  Printer, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  CalendarCheck,
  Info
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, getMonth, getYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { gerarEscalaMensal } from '../utils/scheduling';
import logoCCB from '../assets/logo-ccb.png';

export function EscalaView() {
  const { 
    colaboradoras, 
    locais, 
    escalas, 
    setEscalas, 
    diasAtivos, 
    localidade,
    updateCargaAcumulada 
  } = useStore();
  
  const [dataAlvo, setDataAlvo] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  
  const mesAtual = getMonth(dataAlvo);
  const anoAtual = getYear(dataAlvo);

  const handleGerar = () => {
    const novaEscala = gerarEscalaMensal(anoAtual, mesAtual, colaboradoras, locais, diasAtivos);
    setEscalas(novaEscala);
  };

  const handleConfirmar = () => {
     escalas.forEach(turno => {
       updateCargaAcumulada(turno.colaboradoraId, 1);
     });
     alert('Escala confirmada e histórico atualizado!');
  };

  const mudarMes = (delta: number) => {
    const nova = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth() + delta, 1);
    setDataAlvo(nova);
  };

  // Agrupar escala por data para o grid
  const escalaPorData = useMemo(() => {
    const agrupado: Record<string, Record<string, string>> = {};
    escalas.forEach(t => {
      if (!agrupado[t.data]) agrupado[t.data] = {};
      agrupado[t.data][t.localId] = colaboradoras.find(c => c.id === t.colaboradoraId)?.nome || '-';
    });
    return agrupado;
  }, [escalas, colaboradoras]);

  const datasEscaladas = Object.keys(escalaPorData).sort();

  // Cálculo do Quadro Resumo (Contagem por Colaboradora x Local)
  const resumo = useMemo(() => {
    const r: Record<string, Record<string, number>> = {};
    colaboradoras.forEach(c => {
      r[c.id] = {};
      locais.forEach(l => {
        r[c.id][l.id] = 0;
      });
    });

    escalas.forEach(t => {
      if (r[t.colaboradoraId]) {
        r[t.colaboradoraId][t.localId] = (r[t.colaboradoraId][t.localId] || 0) + 1;
      }
    });

    return r;
  }, [escalas, colaboradoras, locais]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header p/ Impressão / Visual */}
      <header className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none no-print">
           <CalendarCheck className="w-64 h-64 -mr-16 -mt-16" />
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
            <div className="flex flex-col items-center bg-white p-2 rounded-xl">
               <img src={logoCCB} alt="Logo CCB" className="h-24 w-auto object-contain" />
               <p className="text-xl font-black text-slate-800 tracking-widest uppercase mt-2">{localidade}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-2">
            <h1 className="text-4xl font-black text-blue-600 capitalize-first tracking-tighter">
              {format(dataAlvo, 'MMMM yyyy', { locale: ptBR })}
            </h1>
            <p className="text-slate-500 font-black uppercase text-xs tracking-[0.2em]">Escala das Auxiliares das Portas</p>
          </div>
        </div>

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
      <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="px-6 py-5 text-xs font-black text-white uppercase tracking-[0.3em] w-48">Data / Dia</th>
                {locais.map(l => (
                  <th key={l.id} className="px-6 py-5 text-xs font-black text-white uppercase tracking-[0.3em] text-center border-l border-slate-800">
                    {l.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datasEscaladas.length === 0 ? (
                <tr>
                  <td colSpan={locais.length + 1} className="px-6 py-12 text-center text-slate-400 font-medium">
                    Nenhuma escala gerada para este período. Clique em "Recalcular Escala".
                  </td>
                </tr>
              ) : (
                datasEscaladas.map(dataStr => {
                  const dataObj = parseISO(dataStr);
                  const diaSemana = format(dataObj, 'EEEE', { locale: ptBR });
                  const isWeekend = diaSemana === 'domingo' || diaSemana === 'sábado';
                  
                  return (
                    <tr key={dataStr} className={cn("group transition-colors", isWeekend ? "bg-blue-50/30" : "hover:bg-slate-50")}>
                      <td className="px-6 py-4 border-r border-slate-100">
                        <div className="flex flex-col">
                           <span className="text-xl font-black text-slate-900">{format(dataObj, 'dd')}</span>
                           <span className="text-[10px] uppercase font-black text-blue-600 tracking-wider font-mono">{diaSemana}</span>
                        </div>
                      </td>
                      {locais.map(l => (
                        <td key={l.id} className="px-6 py-4 text-center border-l border-slate-100">
                          <p className="font-bold text-slate-800 tracking-tight">{escalaPorData[dataStr][l.id]}</p>
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quadro Resumo */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
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
                <th className="px-6 py-4 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center border-l border-slate-200 bg-blue-50/50">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colaboradoras.sort((a,b) => a.nome.localeCompare(b.nome)).map(c => {
                const total = Object.values(resumo[c.id]).reduce((a, b) => a + b, 0);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-bold text-slate-700 text-sm">{c.nome}</td>
                    {locais.map(l => (
                      <td key={l.id} className="px-6 py-3 text-center text-sm font-medium text-slate-600 border-l border-slate-100">
                        {resumo[c.id][l.id] || 0}
                      </td>
                    ))}
                    <td className="px-6 py-3 text-center font-black text-blue-700 border-l border-slate-100 bg-blue-50/30">
                      {total}
                    </td>
                  </tr>
                );
              })}
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
                <li>• Prioriza colaboradoras com <strong>menor carga acumulada</strong> para garantir equidade.</li>
                <li>• Implementa rotação automática para evitar repetir o mesmo local consecutivamente.</li>
              </ul>
           </div>
        </div>

        <div className="bg-blue-600 rounded-3xl p-8 text-white flex flex-col justify-between shadow-xl shadow-blue-200">
           <div>
              <h3 className="font-black h3 uppercase text-sm tracking-widest mb-2 opacity-80">Ações de Fechamento</h3>
              <p className="text-sm font-semibold opacity-90 leading-relaxed">Considera esta escala definitiva? Ao confirmar, o histórico de turnos de cada colaboradora será atualizado permanentemente.</p>
           </div>
           <button onClick={handleConfirmar} className="mt-6 w-full bg-white text-blue-700 font-black py-4 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
              <CalendarCheck className="w-5 h-5" /> Confirmar Escala do Mês
           </button>
        </div>
      </footer>
    </div>
  );
}
