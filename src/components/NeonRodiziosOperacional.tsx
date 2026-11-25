/**
 * Tela operacional para gerenciamento de rodízios no Neon.
 *
 * Integra:
 * - Listagem de escalas administrativas (somente leitura Neon)
 * - Editor com 7 operações versionadas P0
 * - Geração de escalas com algoritmo existente (P1)
 * - Visualização de itens com edição local (P1)
 *
 * Restrições:
 * - Bloqueado fora da branch descartável Neon HML
 * - Requer perfil admin
 * - Sem fallback Supabase
 * - Sem escrita direta em rodizios ou rodizio_itens
 */

import { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Check,
  Eye,
  Edit,
  Lock,
  Send,
  Zap,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { NeonRelatorioRodizio } from './NeonRelatorioRodizio';
import {
  listarRodiziosAdministrativosNeonHml,
  obterRodizioComItensNeonHml,
} from '../services/neon/rodizioFunctionalHmlService';
import { NeonRodizioEditor } from './NeonRodizioEditor';
import { NeonRodizioGerador } from './NeonRodizioGerador';
import type { RodizioNeonVersionado, RodizioItemInput } from '../types/supabase';

type VistaAtual = 'lista' | 'detalhes' | 'editor' | 'gerar';

interface EstadoOperacional {
  vista: VistaAtual;
  rodizios: RodizioNeonVersionado[];
  rodizioSelecionado: RodizioNeonVersionado | null;
  itens: RodizioItemInput[];
  relatorioRodizioId: string | null;
  carregando: boolean;
  erro: string | null;
  sucesso: string | null;
}

export function NeonRodiziosOperacional() {
  const [estado, setEstado] = useState<EstadoOperacional>({
    vista: 'lista',
    rodizios: [],
    rodizioSelecionado: null,
    itens: [],
    relatorioRodizioId: null,
    carregando: true,
    erro: null,
    sucesso: null,
  });

  // Carregar rodízios ao montar
  useEffect(() => {
    void carregarRodizios();
  }, []);

  /**
   * Carregar lista de rodízios do Neon (somente leitura admin)
   */
  async function carregarRodizios() {
    setEstado((prev) => ({
      ...prev,
      carregando: true,
      erro: null,
    }));

    const result = await listarRodiziosAdministrativosNeonHml();
    if (result.error) {
      setEstado((prev) => ({
        ...prev,
        carregando: false,
        erro: result.error,
      }));
    } else {
      setEstado((prev) => ({
        ...prev,
        rodizios: (result.data || []) as RodizioNeonVersionado[],
        carregando: false,
      }));
    }
  }

  /**
   * Carregar detalhes e itens de um rodízio
   */
  async function abrirDetalhes(rodizio: RodizioNeonVersionado, destino: 'detalhes' | 'editor' = 'detalhes') {
    setEstado((prev) => ({
      ...prev,
      carregando: true,
      erro: null,
    }));

    const result = await obterRodizioComItensNeonHml(rodizio.id);
    if (result.error) {
      setEstado((prev) => ({
        ...prev,
        carregando: false,
        erro: result.error,
      }));
    } else if (result.data) {
      const rodizioData = result.data.rodizio as unknown as RodizioNeonVersionado;
      const itens = result.data.itens || [];
      setEstado((prev) => ({
        ...prev,
        rodizioSelecionado: rodizioData,
        itens: itens.map((item) => ({
          data: item.data,
          porta: item.porta,
          periodo: item.periodo,
          auxiliar_id: item.auxiliar_id,
          observacoes: item.observacoes,
        })),
        vista: destino,
        carregando: false,
      }));
    }
  }

  /**
   * Abrir editor para criar novo rascunho
   */
  function abrirEditorNovo() {
    setEstado((prev) => ({
      ...prev,
      rodizioSelecionado: null,
      itens: [],
      vista: 'editor',
    }));
  }

  /**
   * Abrir editor para editar rodízio existente
   */
  function abrirEditorExistente(rodizio: RodizioNeonVersionado) {
    void abrirDetalhes(rodizio, 'editor');
  }

  /**
   * Fechar editor/detalhes e voltar à lista
   */
  function fecharEditor() {
    setEstado((prev) => ({
      ...prev,
      vista: 'lista',
      rodizioSelecionado: null,
      itens: [],
      sucesso: null,
    }));
    carregarRodizios();
  }

  /**
   * Callback quando uma operação no editor completa com sucesso
   */
  function handleSucessoEditor(mensagem: string) {
    setEstado((prev) => ({
      ...prev,
      sucesso: mensagem,
    }));
    fecharEditor();
  }

  /**
   * Callback quando uma operação no editor falha
   */
  function handleErroEditor(mensagem: string) {
    setEstado((prev) => ({
      ...prev,
      erro: mensagem,
    }));
  }

  // =========================================================================
  // Renderização
  // =========================================================================

  // Vista: Editor
  if (estado.vista === 'editor') {
    return (
      <NeonRodizioEditor
        rodizio={estado.rodizioSelecionado}
        itens={estado.itens}
        onFechar={fecharEditor}
        onSucesso={handleSucessoEditor}
        onErro={handleErroEditor}
      />
    );
  }

  // Vista: Gerar
  if (estado.vista === 'gerar' && estado.rodizioSelecionado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setEstado((prev) => ({ ...prev, vista: 'detalhes' }))}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                ← Voltar
              </button>
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Gerar Escala: {estado.rodizioSelecionado.titulo}
            </h1>

            <p className="text-sm text-slate-600 mb-6">
              Período: {format(parseISO(estado.rodizioSelecionado.data_inicio), 'dd/MM/yyyy')} até{' '}
              {format(parseISO(estado.rodizioSelecionado.data_fim), 'dd/MM/yyyy')}
            </p>

            {estado.erro && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Erro</p>
                  <p className="text-sm text-red-700 mt-1">{estado.erro}</p>
                </div>
              </div>
            )}

            <NeonRodizioGerador
              dadosGeração={{
                rodizio: estado.rodizioSelecionado,
                auxiliares: [],
                restricoes: [],
                historicoTravado: [],
              }}
              onGerado={(itens) => {
                setEstado((prev) => ({
                  ...prev,
                  itens,
                  vista: 'editor',
                }));
              }}
              onErro={(msg) => {
                setEstado((prev) => ({
                  ...prev,
                  erro: msg,
                }));
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Vista: Detalhes
  if (estado.vista === 'detalhes' && estado.rodizioSelecionado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setEstado((prev) => ({ ...prev, vista: 'lista' }))}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                ← Voltar
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (estado.rodizioSelecionado) {
                      setEstado((prev) => ({ ...prev, vista: 'gerar' }));
                    }
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 transition"
                >
                  <Zap size={18} />
                  Gerar
                </button>
                <button
                  onClick={() => {
                    if (estado.rodizioSelecionado) {
                      abrirEditorExistente(estado.rodizioSelecionado);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
                >
                  <Edit size={18} />
                  Editar
                </button>
                <button
                  onClick={() => {
                    if (estado.rodizioSelecionado) {
                      setEstado((prev) => ({ ...prev, relatorioRodizioId: estado.rodizioSelecionado?.id ?? null }));
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition"
                >
                  <FileText size={18} />
                  Relatório
                </button>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {estado.rodizioSelecionado.titulo}
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
                <p className="text-sm font-semibold text-slate-900">
                  {estado.rodizioSelecionado.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Data Início</p>
                <p className="text-sm font-semibold text-slate-900">
                  {format(parseISO(estado.rodizioSelecionado.data_inicio), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Data Fim</p>
                <p className="text-sm font-semibold text-slate-900">
                  {format(parseISO(estado.rodizioSelecionado.data_fim), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Revisão</p>
                <p className="text-sm font-semibold text-slate-900">
                  {estado.rodizioSelecionado.revisao}
                </p>
              </div>
            </div>

            {estado.rodizioSelecionado.observacoes && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-slate-700">
                  <strong>Observações:</strong> {estado.rodizioSelecionado.observacoes}
                </p>
              </div>
            )}
          </div>

          {/* Itens */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Itens da Escala ({estado.itens.length})
            </h2>

            {estado.itens.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum item nesta escala.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Data</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Porta</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Período</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Auxiliar</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {estado.itens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{item.data}</td>
                        <td className="px-4 py-3">{item.porta}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.periodo || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.auxiliar_id
                            ? item.auxiliar_id.substring(0, 8)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {item.observacoes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vista: Lista (padrão)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Gerenciador de Rodízios Neon
              </h1>
              <p className="text-slate-600 mt-1">
                Operações administrativas no ambiente de homologação
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={carregarRodizios}
                disabled={estado.carregando}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50 flex items-center gap-2 transition"
              >
                <RefreshCw size={18} />
                Recarregar
              </button>
              <button
                onClick={abrirEditorNovo}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition"
              >
                <Plus size={18} />
                Novo Rascunho
              </button>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {estado.erro && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-800">Erro</h3>
                <p className="text-sm text-red-700 mt-1">{estado.erro}</p>
              </div>
            </div>
          </div>
        )}

        {estado.sucesso && (
          <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Check className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-green-800">Sucesso</h3>
                <p className="text-sm text-green-700 mt-1">{estado.sucesso}</p>
              </div>
            </div>
          </div>
        )}

        {/* Listagem */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {estado.carregando ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Carregando rodízios...</p>
            </div>
          ) : estado.rodizios.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle size={48} className="text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">Nenhum rodízio encontrado.</p>
              <button
                onClick={abrirEditorNovo}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
              >
                <Plus size={18} />
                Criar Novo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      Título
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      Revisão
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estado.rodizios.map((rodizio) => (
                    <tr
                      key={rodizio.id}
                      className="hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {rodizio.titulo}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          ID: {rodizio.id.substring(0, 8)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {format(parseISO(rodizio.data_inicio), 'dd/MM/yyyy')} até{' '}
                        {format(parseISO(rodizio.data_fim), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            rodizio.status === 'rascunho'
                              ? 'bg-blue-100 text-blue-800'
                              : rodizio.status === 'publicado'
                                ? 'bg-green-100 text-green-800'
                                : rodizio.status === 'travado'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {rodizio.status === 'rascunho' && <Edit size={14} />}
                          {rodizio.status === 'publicado' && <Send size={14} />}
                          {rodizio.status === 'travado' && <Lock size={14} />}
                          {rodizio.status === 'cancelado' && <AlertCircle size={14} />}
                          {rodizio.status.charAt(0).toUpperCase() +
                            rodizio.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {rodizio.revisao}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => abrirDetalhes(rodizio)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            title="Visualizar detalhes"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => abrirEditorExistente(rodizio)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar rodízio"
                          >
                            <Edit size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer de ajuda */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Dica:</strong> Usar o editor para criar rascunhos, atualizar dados,
            gerar escalas, e gerenciar transições de estado (publicar/travar/cancelar).
            Todas as operações requerem revisão original e são protegidas contra
            conflitos.
          </p>
        </div>
      </div>

      {/* Relatório modal */}
      {estado.relatorioRodizioId && (
        <NeonRelatorioRodizio
          rodizioId={estado.relatorioRodizioId}
          onFechar={() => setEstado((prev) => ({ ...prev, relatorioRodizioId: null }))}
        />
      )}
    </div>
  );
}
