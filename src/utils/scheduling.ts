import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  getDay
} from 'date-fns';
import type { Colaboradora, Local, Turno, DiaSemana } from '../types';

const DIAS_MAP: Record<number, DiaSemana> = {
  0: 'Domingo',
  1: 'Segunda-Feira',
  2: 'Terça-Feira',
  3: 'Quarta-Feira',
  4: 'Quinta-Feira',
  5: 'Sexta-Feira',
  6: 'Sábado',
};

// Função para embaralhar lista (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function gerarEscalaMensal(
  ano: number,
  mes: number,
  colaboradoras: Colaboradora[],
  locais: Local[],
  diasAtivos: DiaSemana[]
): Turno[] {
  const dataInicio = startOfMonth(new Date(ano, mes));
  const dataFim = endOfMonth(dataInicio);
  const diasDoMes = eachDayOfInterval({ start: dataInicio, end: dataFim });
  
  // Cálculo da Meta Ideal
  const diasEscalaveis = diasDoMes.filter(d => diasAtivos.includes(DIAS_MAP[getDay(d)])).length;
  const totalVagas = diasEscalaveis * locais.length;
  const mediaIdeal = totalVagas / colaboradoras.length;

  const escala: Turno[] = [];
  
  // Rastreadores de Estado
  const contagemMensal: Record<string, number> = {};
  const contagemPorLocal: Record<string, Record<string, number>> = {};
  const ultimoLocal: Record<string, string | null> = {};
  const ultimaDataTrabalhada: Record<string, string | null> = {};

  colaboradoras.forEach(c => {
    contagemMensal[c.id] = 0;
    contagemPorLocal[c.id] = {};
    ultimoLocal[c.id] = null;
    ultimaDataTrabalhada[c.id] = null;
    locais.forEach(l => {
      contagemPorLocal[c.id][l.id] = 0;
    });
  });

  diasDoMes.forEach((dia, diaIdx) => {
    const nomeDia = DIAS_MAP[getDay(dia)];
    
    if (diasAtivos.includes(nomeDia)) {
      const dataStr = format(dia, 'yyyy-MM-dd');
      const dataAnteriorStr = diaIdx > 0 ? format(diasDoMes[diaIdx - 1], 'yyyy-MM-dd') : null;
      const ocupadasNoDia: string[] = [];

      // SORTEAR a ordem dos locais para evitar vício no primeiro local da lista
      const locaisNoDia = shuffle([...locais]);

      locaisNoDia.forEach(local => {
        // Buscar a melhor candidata para ESTE local específico agora
        const candidatas = shuffle([...colaboradoras])
          .filter(c => {
            const hasDayRestriction = c.restricoes.dia?.includes(nomeDia);
            const hasLocalRestriction = c.restricoes.local?.includes(local.nome);
            const alreadyAssigned = ocupadasNoDia.includes(c.id);
            return !hasDayRestriction && !hasLocalRestriction && !alreadyAssigned;
          })
          .map(c => {
            let score = 0;
            // 1. Penalizar quem já trabalhou muito no mês (Peso alto para equilíbrio total)
            score += contagemMensal[c.id] * 12;
            
            // 2. Penalizar repetição neste local específico
            score += (contagemPorLocal[c.id][local.id] || 0) * 8;
            
            // 3. Penalizar se trabalhou no último dia de escala (descanso)
            if (ultimaDataTrabalhada[c.id] === dataAnteriorStr) score += 10;
            
            // 4. Penalizar se o ÜLTIMO local dela foi este mesmo (evitar "colar" no posto)
            if (ultimoLocal[c.id] === local.id) score += 10;

            // 5. Bônus se estiver abaixo da média ideal
            if (contagemMensal[c.id] < mediaIdeal) score -= 8;

            return { ...c, score };
          })
          .sort((a, b) => a.score - b.score);

        if (candidatas.length > 0) {
          const selecionada = candidatas[0];
          
          escala.push({
            id: crypto.randomUUID(),
            data: dataStr,
            localId: local.id,
            colaboradoraId: selecionada.id
          });

          // Atualizar contadores
          ocupadasNoDia.push(selecionada.id);
          contagemMensal[selecionada.id]++;
          contagemPorLocal[selecionada.id][local.id] = (contagemPorLocal[selecionada.id][local.id] || 0) + 1;
          ultimoLocal[selecionada.id] = local.id;
          ultimaDataTrabalhada[selecionada.id] = dataStr;
        }
      });
    }
  });

  return escala;
}
