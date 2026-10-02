import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Colaboradora, Local, Turno, DiaSemana } from '../types';

interface AppState {
  colaboradoras: Colaboradora[];
  locais: Local[];
  escalas: Turno[];
  diasAtivos: DiaSemana[];
  localidade: string;
  dataAlvo: string; // ISO String
  
  carregando: boolean;

  // Actions
  carregarDadosNativos: () => Promise<void>;
  addColaboradora: (col: Colaboradora) => Promise<void>;
  removeColaboradora: (id: string) => Promise<void>;
  updateColaboradora: (col: Colaboradora) => Promise<void>;
  
  addLocal: (loc: Local) => Promise<void>;
  removeLocal: (id: string) => Promise<void>;
  
  setEscalas: (escalas: Turno[]) => void;
  setDataAlvo: (data: string) => void;
  updateCargaAcumulada: (colaboradoraId: string, delta: number) => Promise<void>;
}

type ColRow = { id: string; nome: string; restricoes: Colaboradora['restricoes'] | null; carga_acumulada: number | null };

const colToRow = (c: Colaboradora) => ({
  id: c.id,
  nome: c.nome,
  restricoes: c.restricoes ?? {},
  carga_acumulada: c.cargaAcumulada,
});

const rowToCol = (r: ColRow): Colaboradora => ({
  id: r.id,
  nome: r.nome,
  restricoes: r.restricoes ?? {},
  cargaAcumulada: r.carga_acumulada ?? 0,
});

const logErro = (acao: string, error: unknown) => console.error(`[Supabase] ${acao}:`, error);

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      colaboradoras: [],
      locais: [],
      escalas: [],
      carregando: false,
      diasAtivos: ['Domingo', 'Terça-Feira', 'Sábado'],
      localidade: 'JARDIM SANTO EDUARDO',
      dataAlvo: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),

      carregarDadosNativos: async () => {
        set({ carregando: true });
        try {
          const [cols, locs, escs] = await Promise.all([
            supabase.from('colaboradoras').select('*').order('nome'),
            supabase.from('locais').select('*').order('nome'),
            supabase.from('escalas').select('*'),
          ]);
          if (cols.error) logErro('carregar colaboradoras', cols.error);
          if (locs.error) logErro('carregar locais', locs.error);
          if (escs.error) logErro('carregar escalas', escs.error);
          set((state) => ({
            colaboradoras: cols.error ? state.colaboradoras : (cols.data as ColRow[]).map(rowToCol),
            locais: locs.error ? state.locais : (locs.data as Local[]).map((l) => ({ id: l.id, nome: l.nome })),
            escalas: escs.error
              ? state.escalas
              : (escs.data as { id: string; data: string; local_id: string; colaboradora_id: string }[]).map((e) => ({
                  id: e.id,
                  data: e.data,
                  localId: e.local_id,
                  colaboradoraId: e.colaboradora_id,
                })),
          }));
        } catch (error) {
          logErro('carregar dados', error);
        } finally {
          set({ carregando: false });
        }
      },

      addColaboradora: async (col) => {
        const { error } = await supabase.from('colaboradoras').insert(colToRow(col));
        if (error) return logErro('inserir colaboradora', error);
        set((state) => ({ colaboradoras: [...state.colaboradoras, col] }));
      },
      removeColaboradora: async (id) => {
        const { error } = await supabase.from('colaboradoras').delete().eq('id', id);
        if (error) return logErro('remover colaboradora', error);
        set((state) => ({ colaboradoras: state.colaboradoras.filter(c => c.id !== id) }));
      },
      updateColaboradora: async (col) => {
        const { error } = await supabase.from('colaboradoras').update(colToRow(col)).eq('id', col.id);
        if (error) return logErro('atualizar colaboradora', error);
        set((state) => ({ colaboradoras: state.colaboradoras.map(c => c.id === col.id ? col : c) }));
      },

      addLocal: async (loc) => {
        const { error } = await supabase.from('locais').insert({ id: loc.id, nome: loc.nome });
        if (error) return logErro('inserir local', error);
        set((state) => ({ locais: [...state.locais, loc] }));
      },
      removeLocal: async (id) => {
        const { error } = await supabase.from('locais').delete().eq('id', id);
        if (error) return logErro('remover local', error);
        set((state) => ({ locais: state.locais.filter(l => l.id !== id) }));
      },

      setEscalas: (escalas) => set({ escalas }),
      setDataAlvo: (dataAlvo) => set({ dataAlvo }),
      
      updateCargaAcumulada: async (colaboradoraId, delta) => {
        const atual = get().colaboradoras.find(c => c.id === colaboradoraId);
        if (!atual) return;
        const nova = atual.cargaAcumulada + delta;
        const { error } = await supabase.from('colaboradoras').update({ carga_acumulada: nova }).eq('id', colaboradoraId);
        if (error) return logErro('atualizar carga acumulada', error);
        set((state) => ({
          colaboradoras: state.colaboradoras.map(c => c.id === colaboradoraId ? { ...c, cargaAcumulada: nova } : c)
        }));
      },
    }),
    {
      name: 'escala-portaria-storage',
      partialize: (state) => ({ diasAtivos: state.diasAtivos, localidade: state.localidade, dataAlvo: state.dataAlvo }),
    }
  )
);
