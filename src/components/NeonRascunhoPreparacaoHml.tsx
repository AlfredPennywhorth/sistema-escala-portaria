import { useMemo, useState } from 'react';
import type { Auxiliar, Rodizio, RodizioComItens, RodizioItemInput } from '../types/supabase';

interface Props {
  detalhe: RodizioComItens;
  auxiliares: Auxiliar[];
}

type Cabecalho = { titulo: string; dataInicio: string; dataFim: string; observacoes: string };

function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  if (ano < 1 || ano > 9999 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const dt = new Date(0);
  dt.setUTCFullYear(ano, mes - 1, dia);
  return dt.toISOString().slice(0, 10) === data;
}

/**
 * Editor exclusivamente LOCAL da proposta de integração Neon.
 * Não importa serviços de escrita, não tem botão de salvar e não dispara RPC.
 * O número de revisão pertence ao snapshot ABERTO, nunca ao refetch de salvamento.
 */
export function NeonRascunhoPreparacaoHml({ detalhe, auxiliares }: Props) {
  const escala = detalhe.rodizio as Rodizio & { revisao?: number | string };
  const revisaoOriginal = escala.revisao;
  const [cabecalho, setCabecalho] = useState<Cabecalho>({
    titulo: escala.titulo,
    dataInicio: escala.data_inicio,
    dataFim: escala.data_fim,
    observacoes: escala.observacoes ?? '',
  });
  const [itens, setItens] = useState<RodizioItemInput[]>(() => detalhe.itens.map(item => ({
    data: item.data,
    porta: item.porta,
    periodo: item.periodo,
    auxiliar_id: item.auxiliar_id,
    observacoes: item.observacoes,
  })));

  const erros = useMemo(() => {
    const mensagens: string[] = [];
    const revisao = typeof revisaoOriginal === 'number' ? revisaoOriginal : Number(revisaoOriginal);
    if (revisaoOriginal == null || !Number.isSafeInteger(revisao) || revisao < 0) {
      mensagens.push('Revisão original ausente ou inválida. Reabra o rascunho.');
    }
    if (!cabecalho.titulo.trim() || cabecalho.titulo.trim().length > 200) {
      mensagens.push('Título obrigatório, limitado a 200 caracteres.');
    }
    if (!dataValida(cabecalho.dataInicio) || !dataValida(cabecalho.dataFim) ||
        cabecalho.dataInicio > cabecalho.dataFim) {
      mensagens.push('Período da escala inválido.');
    }
    if (itens.length < 1 || itens.length > 500) {
      mensagens.push('O rascunho deve conter entre 1 e 500 itens.');
    }
    itens.forEach((item, indice) => {
      if (!dataValida(item.data) || !item.porta.trim()) {
        mensagens.push('Item ' + (indice + 1) + ': data e porta válidas são obrigatórias.');
      }
      if (item.data < cabecalho.dataInicio || item.data > cabecalho.dataFim) {
        mensagens.push('Item ' + (indice + 1) + ': data fora do período do rascunho.');
      }
      if (item.auxiliar_id && !auxiliares.some(auxiliar => auxiliar.id === item.auxiliar_id)) {
        mensagens.push('Item ' + (indice + 1) + ': auxiliar não encontrada nos dados carregados.');
      }
    });
    return mensagens;
  }, [auxiliares, cabecalho, itens, revisaoOriginal]);

  if (escala.status !== 'rascunho' || escala.travado) {
    return <p className="text-sm text-slate-700">Preparação disponível apenas para rascunhos não travados.</p>;
  }

  const estilo = 'w-full rounded-md border border-slate-300 p-2 text-sm';
  const mudarItem = (indice: number, campo: keyof RodizioItemInput, valor: string | null) => {
    setItens(anteriores => anteriores.map((item, i) => i === indice
      ? { ...item, [campo]: valor }
      : item));
  };
  return (
    <section className="rounded-xl border border-amber-300 bg-white p-4 shadow-sm" aria-label="Preparação local de rascunho Neon">
      <h3 className="text-lg font-semibold text-slate-900">Preparação do editor de rascunho — sem gravação</h3>
      <p className="mt-1 text-sm text-amber-900">
        Alterações permanecem apenas nesta tela e serão descartadas ao sair ou atualizar.
        Nenhuma RPC ou escrita é executada enquanto os gates SQL13/SQL12 estiverem pendentes.
      </p>
      <p className="mt-2 text-sm font-medium text-slate-700">
        Revisão original do editor: {String(revisaoOriginal ?? 'indisponível')} (imutável)
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-700 sm:col-span-2">
          Título
          <input className={estilo} value={cabecalho.titulo} maxLength={200}
            onChange={e => setCabecalho(atual => ({ ...atual, titulo: e.target.value }))} />
        </label>
        <label className="text-sm text-slate-700">
          Início
          <input type="date" className={estilo} value={cabecalho.dataInicio}
            onChange={e => setCabecalho(atual => ({ ...atual, dataInicio: e.target.value }))} />
        </label>
        <label className="text-sm text-slate-700">
          Fim
          <input type="date" className={estilo} value={cabecalho.dataFim}
            onChange={e => setCabecalho(atual => ({ ...atual, dataFim: e.target.value }))} />
        </label>
        <label className="text-sm text-slate-700 sm:col-span-2">
          Observações
          <textarea className={estilo} rows={2} value={cabecalho.observacoes}
            onChange={e => setCabecalho(atual => ({ ...atual, observacoes: e.target.value }))} />
        </label>
      </div>
      <h4 className="mt-4 font-semibold text-slate-900">Itens do rascunho ({itens.length})</h4>
      <div className="mt-2 space-y-3">
        {itens.map((item, indice) => (
          <fieldset key={indice} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">Item {indice + 1}</legend>
            <label className="text-sm">Data
              <input type="date" className={estilo} value={item.data}
                onChange={e => mudarItem(indice, 'data', e.target.value)} />
            </label>
            <label className="text-sm">Porta
              <input className={estilo} value={item.porta}
                onChange={e => mudarItem(indice, 'porta', e.target.value)} />
            </label>
            <label className="text-sm">Período
              <input className={estilo} value={item.periodo ?? ''}
                onChange={e => mudarItem(indice, 'periodo', e.target.value || null)} />
            </label>
            <label className="text-sm">Auxiliar
              <select className={estilo} value={item.auxiliar_id ?? ''}
                onChange={e => mudarItem(indice, 'auxiliar_id', e.target.value || null)}>
                <option value="">Sem auxiliar</option>
                {auxiliares.map(auxiliar => (
                  <option key={auxiliar.id} value={auxiliar.id}>{auxiliar.nome}</option>
                ))}
              </select>
            </label>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm" role="status">
        {erros.length === 0
          ? 'Validação local concluída. A gravação permanece indisponível até homologação e autorização.'
          : 'Validação local: ' + erros.length + ' pendência(s).'}
      </div>
      {erros.length > 0 && <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
        {erros.map((erro, indice) => <li key={indice}>{erro}</li>)}
      </ul>}
    </section>
  );
}
