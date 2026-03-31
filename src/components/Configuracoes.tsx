import { useStore } from '../store/useStore';
import { MapPin, Trash2, Plus, Info } from 'lucide-react';
import { useState } from 'react';

export function Configuracoes() {
  const { locais, localidade, addLocal, removeLocal } = useStore();
  const [novoLocal, setNovoLocal] = useState('');

  const handleAdd = () => {
    if (!novoLocal) return;
    addLocal({ id: crypto.randomUUID(), nome: novoLocal });
    setNovoLocal('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Configurações Gerais</h1>
        <p className="text-slate-500 font-bold">Gerencie os locais de atendimento e dados da localidade.</p>
      </header>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-xl font-black text-slate-700 uppercase tracking-widest text-sm">Locais de Atendimento</h2>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex gap-3">
            <input 
              type="text" 
              value={novoLocal}
              onChange={e => setNovoLocal(e.target.value)}
              className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" 
              placeholder="Digite o nome do novo local (Ex: Portão B)"
            />
            <button onClick={handleAdd} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Adicionar
            </button>
          </div>

          <div className="divide-y divide-slate-50">
            {locais.map(l => (
              <div key={l.id} className="p-5 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                <span className="font-bold text-slate-700">{l.nome}</span>
                <button onClick={() => removeLocal(l.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 overflow-hidden relative">
         <div className="absolute -bottom-10 -right-10 opacity-10">
            <Info className="w-48 h-48" />
         </div>
         <div className="relative z-10 space-y-4">
            <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
               <Info className="w-5 h-5 text-blue-400" />
               Dados da Localidade
            </h2>
            <div className="space-y-1">
               <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Nome em Exibição</label>
               <p className="text-2xl font-black text-white">{localidade}</p>
            </div>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
               Este nome será exibido no cabeçalho de todas as escalas mensais geradas. Para alterar este valor, é necessário acesso administrativo ao arquivo de configuração do sistema.
            </p>
         </div>
      </section>
    </div>
  );
}
