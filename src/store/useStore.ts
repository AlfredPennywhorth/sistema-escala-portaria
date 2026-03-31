import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Colaboradora, Local, Turno, DiaSemana } from '../types';

interface AppState {
  colaboradoras: Colaboradora[];
  locais: Local[];
  escalas: Turno[];
  diasAtivos: DiaSemana[];
  localidade: string;
  dataAlvo: string; // ISO String
  
  // Actions
  addColaboradora: (col: Colaboradora) => void;
  removeColaboradora: (id: string) => void;
  updateColaboradora: (col: Colaboradora) => void;
  
  addLocal: (loc: Local) => void;
  removeLocal: (id: string) => void;
  
  setEscalas: (escalas: Turno[]) => void;
  setDataAlvo: (data: string) => void;
  updateCargaAcumulada: (colaboradoraId: string, delta: number) => void;
}

const INITIAL_COLABORADORAS: Colaboradora[] = [
  { id: '1', nome: 'Bruna Diego', restricoes: {}, cargaAcumulada: 0 },
  { id: '2', nome: 'Bruna Gasque', restricoes: { dia: ['Terça-Feira'] }, cargaAcumulada: 0 },
  { id: '3', nome: 'Dalete', restricoes: {}, cargaAcumulada: 0 },
  { id: '4', nome: 'Josefa', restricoes: {}, cargaAcumulada: 0 },
  { id: '5', nome: 'Lourdes', restricoes: { local: ['Sanitário'] }, cargaAcumulada: 0 },
  { id: '6', nome: 'Maria (Manoel)', restricoes: { local: ['Galeria', 'Sanitário'] }, cargaAcumulada: 0 },
  { id: '7', nome: 'Maria (Severino)', restricoes: {}, cargaAcumulada: 0 },
  { id: '8', nome: 'Nelida', restricoes: {}, cargaAcumulada: 0 },
  { id: '9', nome: 'Sueli', restricoes: {}, cargaAcumulada: 0 },
];

const INITIAL_LOCAIS: Local[] = [
  { id: 'l1', nome: 'Entrada' },
  { id: 'l2', nome: 'Galeria' },
  { id: 'l3', nome: 'Lateral' },
  { id: 'l4', nome: 'Sanitário' },
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      colaboradoras: INITIAL_COLABORADORAS,
      locais: INITIAL_LOCAIS,
      escalas: [],
      diasAtivos: ['Domingo', 'Terça-Feira', 'Sábado'],
      localidade: 'JARDIM SANTO EDUARDO',
      dataAlvo: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),

      addColaboradora: (col) => set((state) => ({ colaboradoras: [...state.colaboradoras, col] })),
      removeColaboradora: (id) => set((state) => ({ colaboradoras: state.colaboradoras.filter(c => c.id !== id) })),
      updateColaboradora: (col) => set((state) => ({ 
        colaboradoras: state.colaboradoras.map(c => c.id === col.id ? col : c) 
      })),

      addLocal: (loc) => set((state) => ({ locais: [...state.locais, loc] })),
      removeLocal: (id) => set((state) => ({ locais: state.locais.filter(l => l.id !== id) })),

      setEscalas: (escalas) => set({ escalas }),
      setDataAlvo: (dataAlvo) => set({ dataAlvo }),
      
      updateCargaAcumulada: (colaboradoraId, delta) => set((state) => ({
        colaboradoras: state.colaboradoras.map(c => 
          c.id === colaboradoraId ? { ...c, cargaAcumulada: c.cargaAcumulada + delta } : c
        )
      })),
    }),
    {
      name: 'escala-portaria-storage',
    }
  )
);
