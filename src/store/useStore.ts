import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Colaboradora, Local, Turno, DiaSemana } from '../types';

interface AppState {
  locais: Local[];
  escalas: Turno[];
  diasAtivos: DiaSemana[];
  localidade: string;
  dataAlvo: string; // ISO String
  
  // Actions
  addLocal: (loc: Local) => void;
  removeLocal: (id: string) => void;
  
  setEscalas: (escalas: Turno[]) => void;
  setDataAlvo: (data: string) => void;
  updateCargaAcumulada: (colaboradoraId: string, delta: number) => void;
}


const INITIAL_LOCAIS: Local[] = [
  { id: 'l1', nome: 'Entrada' },
  { id: 'l2', nome: 'Galeria' },
  { id: 'l3', nome: 'Lateral' },
  { id: 'l4', nome: 'Sanitário' },
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      locais: INITIAL_LOCAIS,
      escalas: [],
      diasAtivos: ['Domingo', 'Terça-Feira', 'Sábado'],
      localidade: 'JARDIM SANTO EDUARDO',
      dataAlvo: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),


      addLocal: (loc) => set((state) => ({ locais: [...state.locais, loc] })),
      removeLocal: (id) => set((state) => ({ locais: state.locais.filter(l => l.id !== id) })),

      setEscalas: (escalas) => set({ escalas }),
      setDataAlvo: (dataAlvo) => set({ dataAlvo }),
    }),
    {
      name: 'escala-portaria-storage',
    }
  )
);
