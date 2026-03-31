import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Colaboradora, DiaSemana } from '../types';
import { Trash2, UserPlus, ShieldAlert, CheckCircle2, Settings } from 'lucide-react';
import { cn } from '../utils/cn';

const DIAS: DiaSemana[] = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];

export function ColaboradorasManager() {
  const { colaboradoras, locais, addColaboradora, removeColaboradora, updateColaboradora } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [restricaoDias, setRestricaoDias] = useState<DiaSemana[]>([]);
  const [restricaoLocais, setRestricaoLocais] = useState<string[]>([]);

  const toggleDia = (dia: DiaSemana) => {
    setRestricaoDias(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const toggleLocal = (localNome: string) => {
    setRestricaoLocais(prev => prev.includes(localNome) ? prev.filter(l => l !== localNome) : [...prev, localNome]);
  };

  const save = () => {
    if (!nome) return;
    
    const data = {
      id: editingId || crypto.randomUUID(),
      nome,
      restricoes: {
        dia: restricaoDias.length > 0 ? restricaoDias : undefined,
        local: restricaoLocais.length > 0 ? restricaoLocais : undefined
      },
      cargaAcumulada: editingId ? colaboradoras.find(c => c.id === editingId)!.cargaAcumulada : 0
    };

    if (editingId) updateColaboradora(data);
    else addColaboradora(data);

    reset();
  };

  const reset = () => {
    setEditingId(null);
    setNome('');
    setRestricaoDias([]);
    setRestricaoLocais([]);
  };

  const edit = (c: Colaboradora) => {
    setEditingId(c.id);
    setNome(c.nome);
    setRestricaoDias(c.restricoes.dia || []);
    setRestricaoLocais(c.restricoes.local || []);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Equipe de Portaria</h1>
          <p className="text-slate-500 font-medium">Gerencie as colaboradoras e suas restrições de trabalho.</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <section className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              {editingId ? 'Editar Colaboradora' : 'Nova Colaboradora'}
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="Ex: Maria Souza"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                   <ShieldAlert className="w-4 h-4 text-amber-500" />
                   Restrições de Dia (Não Escalar)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIAS.filter(d => ['Domingo', 'Terça-Feira', 'Sábado'].includes(d)).map(dia => (
                    <button
                      key={dia}
                      onClick={() => toggleDia(dia)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        restricaoDias.includes(dia) 
                          ? "bg-red-100 text-red-700 border-red-200 border" 
                          : "bg-slate-50 text-slate-600 border-slate-100 border hover:bg-slate-100"
                      )}
                    >
                      {dia}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                   <ShieldAlert className="w-4 h-4 text-amber-500" />
                   Restrições de Local (Não Escalar)
                </label>
                <div className="flex flex-wrap gap-2">
                  {locais.map(local => (
                    <button
                      key={local.id}
                      onClick={() => toggleLocal(local.nome)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        restricaoLocais.includes(local.nome) 
                          ? "bg-red-100 text-red-700 border-red-200 border" 
                          : "bg-slate-50 text-slate-600 border-slate-100 border hover:bg-slate-100"
                      )}
                    >
                      {local.nome}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={save}
                  className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
                {editingId && (
                  <button onClick={reset} className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* List Column */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Colaboradora</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Restrições (Não Atende)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Carga Acum.</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colaboradoras.map(c => (
                  <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                          {c.nome.charAt(0)}
                        </div>
                        <p className="font-bold text-slate-800">{c.nome}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {!c.restricoes.dia && !c.restricoes.local && (
                          <span className="text-slate-400 text-sm flex items-center gap-1 italic">
                             <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Sem restrições
                          </span>
                        )}
                        {c.restricoes.dia?.map(d => (
                          <span key={d} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md uppercase border border-amber-100">{d}</span>
                        ))}
                        {c.restricoes.local?.map(l => (
                          <span key={l} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md uppercase border border-indigo-100">{l}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-700 text-xs font-black rounded-lg">
                        {c.cargaAcumulada}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => edit(c)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => removeColaboradora(c.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
