/**
 * @file NeonRodizioGerador.tsx
 * @description P1 - Componente de geração de escalas para Neon
 *
 * Integra:
 * - Geração automática usando algoritmo existente
 * - Preview de qualidade (alertas, equilíbrio, violações)
 * - Edição local de itens (adicionar, remover, clonar)
 * - Preparação para salvamento via RPC substituirItensNeonEditor
 */

import { useState } from 'react';
import { Zap, ChevronDown, Trash2, Copy, AlertCircle } from 'lucide-react';
import {
  gerarSugestaoRodizioNeon,
  calcularQualidadeSugestao,
  type DadosGeracaoNeon,
  type SugestaoGeracaoNeon,
} from '../services/neon/rodizioGeracaoNeonService';
import type { RodizioItemInput } from '../types/supabase';

interface NeonRodizioGeradorProps {
  dadosGeração: DadosGeracaoNeon;
  onGerado?: (itens: RodizioItemInput[], sugestao: SugestaoGeracaoNeon) => void;
  onErro?: (mensagem: string) => void;
}

export function NeonRodizioGerador({
  dadosGeração,
  onGerado,
  onErro,
}: NeonRodizioGeradorProps) {
  const [gerando, setGerando] = useState(false);
  const [sugestao, setSugestao] = useState<SugestaoGeracaoNeon | null>(null);
  const [itensEditando, setItensEditando] = useState<RodizioItemInput[]>([]);
  const [expandidoDetalhes, setExpandidoDetalhes] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleGerar() {
    setGerando(true);
    setErro(null);
    setSugestao(null);

    try {
      const resultado = gerarSugestaoRodizioNeon(dadosGeração);

      if (resultado.itens.length === 0) {
        setErro(
          'Não foi possível gerar itens. Verifique: auxiliares ativas, portas configuradas e período do rodízio.'
        );
        onErro?.(
          'Nenhum item gerado. Revise auxiliares, restrições e disponibilidade.'
        );
        setGerando(false);
        return;
      }

      setSugestao(resultado);
      setItensEditando(
        resultado.itens.map((item) => ({
          data: item.data,
          porta: item.porta,
          periodo: item.periodo || null,
          auxiliar_id: item.auxiliarId,
          observacoes: item.motivoSelecao.join('; ') || null,
        }))
      );

      onGerado?.(itensEditando, resultado);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido na geração';
      setErro(msg);
      onErro?.(msg);
    } finally {
      setGerando(false);
    }
  }

  function removerItem(index: number) {
    setItensEditando(itensEditando.filter((_, i) => i !== index));
  }

  function duplicarItem(index: number) {
    const item = itensEditando[index];
    if (!item) return;
    setItensEditando([...itensEditando, { ...item }]);
  }

  function editarItem(index: number, campo: keyof RodizioItemInput, valor: unknown) {
    const novoItens = [...itensEditando];
    novoItens[index] = { ...novoItens[index], [campo]: valor };
    setItensEditando(novoItens);
  }

  if (!sugestao) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Zap size={20} className="text-yellow-600" />
            Gerar Escala
          </h3>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Gera automaticamente os itens da escala aplicando o algoritmo de equilíbrio,
          considerando auxiliares, restrições, indisponibilidades e histórico.
        </p>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{erro}</div>
          </div>
        )}

        <button
          onClick={handleGerar}
          disabled={gerando}
          className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
        >
          <Zap size={18} />
          {gerando ? 'Gerando...' : 'Gerar Sugestão'}
        </button>
      </div>
    );
  }

  const qualidade = calcularQualidadeSugestao(sugestao);

  return (
    <div className="space-y-4">
      {/* Resumo da geração */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900">Sugestão Gerada</h3>
          <button
            onClick={() => setSugestao(null)}
            className="px-3 py-1 text-sm text-slate-600 hover:text-slate-900 transition"
          >
            Descartar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total de Itens</p>
            <p className="text-2xl font-bold text-slate-900">{qualidade.totalItens}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Alertas</p>
            <p className="text-2xl font-bold text-yellow-600">{qualidade.alertasCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Violações</p>
            <p className="text-2xl font-bold text-red-600">{qualidade.violacoesCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Equilíbrio</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${qualidade.equilibrio}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {qualidade.equilibrio.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Alertas e violações */}
        {(sugestao.alertas.length > 0 || sugestao.violacoes.length > 0) && (
          <div className="space-y-2 mb-4">
            {sugestao.alertas.map((alerta, i) => (
              <div key={i} className="text-sm text-yellow-700 flex gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{alerta.mensagem}</span>
              </div>
            ))}
            {sugestao.violacoes.map((violacao, i) => (
              <div key={i} className="text-sm text-red-700 flex gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>
                  {violacao.auxiliar} em {violacao.data} (Porta {violacao.porta}): {violacao.restricao}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setExpandidoDetalhes(!expandidoDetalhes)}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
        >
          <ChevronDown size={16} className={expandidoDetalhes ? 'rotate-180' : ''} />
          {expandidoDetalhes ? 'Ocultar' : 'Mostrar'} Detalhes
        </button>

        {expandidoDetalhes && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
            {sugestao.metricas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Equilíbrio por Auxiliar:</p>
                <div className="space-y-1">
                  {sugestao.metricas.slice(0, 5).map((m, i) => (
                    <div
                      key={i}
                      className="text-xs text-slate-600 flex items-center justify-between"
                    >
                      <span>{m.auxiliarNome}</span>
                      <span className="font-semibold">{m.totalNovo} itens (novo)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabela de itens editável */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900">Itens da Escala</h3>
          <button
            onClick={() => {
              const novoItem: RodizioItemInput = {
                data: '',
                porta: '',
                periodo: null,
                auxiliar_id: null,
                observacoes: null,
              };
              setItensEditando([...itensEditando, novoItem]);
            }}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Adicionar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-2 font-semibold text-slate-700">Data</th>
                <th className="text-left p-2 font-semibold text-slate-700">Porta</th>
                <th className="text-left p-2 font-semibold text-slate-700">Auxiliar ID</th>
                <th className="text-left p-2 font-semibold text-slate-700">Observações</th>
                <th className="text-center p-2 font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {itensEditando.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2">
                    <input
                      type="date"
                      value={item.data}
                      onChange={(e) => editarItem(idx, 'data', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.porta}
                      onChange={(e) => editarItem(idx, 'porta', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      placeholder="1, 2..."
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.auxiliar_id || ''}
                      onChange={(e) => editarItem(idx, 'auxiliar_id', e.target.value || null)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      placeholder="UUID"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.observacoes || ''}
                      onChange={(e) => editarItem(idx, 'observacoes', e.target.value || null)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      placeholder="Notas"
                    />
                  </td>
                  <td className="p-2 text-center flex justify-center gap-1">
                    <button
                      onClick={() => duplicarItem(idx)}
                      className="p-1 text-slate-500 hover:text-slate-700 transition"
                      title="Duplicar"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => removerItem(idx)}
                      className="p-1 text-red-500 hover:text-red-700 transition"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {itensEditando.length === 0 && (
          <div className="text-center py-8 text-slate-500">Nenhum item adicionado</div>
        )}
      </div>
    </div>
  );
}
