/**
 * Editor de rodízios operacional para Neon.
 *
 * Integra as 7 operações versionadas P0:
 * 1. Criar rascunho
 * 2. Atualizar cabeçalho
 * 3. Substituir itens
 * 4. Publicar escala
 * 5. Travar escala
 * 6. Cancelar escala
 * 7. Excluir rascunho
 *
 * Preserva a revisão original capturada na abertura.
 * Trata conflitos OCC, falhas de autorização, timeout e respostas indeterminadas.
 */

import { useEffect, useRef, useState } from 'react';
import { Save, X, AlertCircle, Check, Lock, Trash2, Send, ChevronDown, Zap } from 'lucide-react';
import type { RodizioNeonVersionado, RodizioItemInput, Auxiliar } from '../types/supabase';
import {
  criarRascunhoNeonEditor,
  atualizarCabecalhoNeonEditor,
  substituirItensNeonEditor,
  publicarRodizioNeonEditor,
  travarRodizioNeonEditor,
  cancelarRodizioNeonEditor,
  excluirRascunhoNeonEditor,
  type CriacaoRascunhoNeon,
  type AtualizacaoCabecalhoNeon,
  type SubstituicaoItensNeon,
  type TransicaoEstadoNeon,
  type CancelamentoNeon,
  type ExclusaoRascunhoNeon,
} from '../services/neon/rodizioEditorNeonService';
import { NeonRodizioGerador } from './NeonRodizioGerador';
import { listarAuxiliares } from '../services/neon/auxiliaresService';
import { PORTAS_GERACAO_NEON } from '../services/neon/rodizioGeracaoNeonService';

interface NeonRodizioEditorProps {
  rodizio: RodizioNeonVersionado | null;
  itens: RodizioItemInput[];
  onFechar: () => void;
  onSucesso?: (mensagem: string, novaRevisao?: number) => void;
  onErro?: (mensagem: string) => void;
}

export function NeonRodizioEditor({
  rodizio,
  itens: itensInicial,
  onFechar,
  onSucesso,
  onErro,
}: NeonRodizioEditorProps) {
  // Estado da vista (edição ou geração)
  const [vista, setVista] = useState<'editar' | 'gerar'>('editar');

  // Estado local do editor
  const [titulo, setTitulo] = useState(rodizio?.titulo ?? '');
  const [dataInicio, setDataInicio] = useState(rodizio?.data_inicio ?? '');
  const [dataFim, setDataFim] = useState(rodizio?.data_fim ?? '');
  const [observacoes, setObservacoes] = useState(rodizio?.observacoes ?? '');

  // Estado dos itens
  const [itens, setItens] = useState<RodizioItemInput[]>(itensInicial);

  const [auxiliares, setAuxiliares] = useState<Auxiliar[] | null>(null);
  const [erroAuxiliares, setErroAuxiliares] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    if (rodizio) void listarAuxiliares(true).then(r => {
      if (!ativo) return;
      if (r.error || !r.data || r.data.length >= 1000) setErroAuxiliares(r.error || 'Cadastro indisponível ou incompleto.');
      else setAuxiliares(r.data);
    });
    return () => { ativo = false; };
  }, [rodizio]);

  // Controle de operação
  const [emOperacao, setEmOperacao] = useState(false);
  const [operacaoAtual, setOperacaoAtual] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [novaRevisao, setNovaRevisao] = useState<number | null>(null);

  // Revisão original capturada ao abrir o editor
  const [revisaoOriginal] = useState(() => {
    const valor = rodizio?.revisao;
    if (typeof valor !== 'number' && (typeof valor !== 'string' || !/^\d+$/.test(valor))) return Number.NaN;
    const numero = Number(valor);
    return Number.isSafeInteger(numero) && numero >= 0 && numero < Number.MAX_SAFE_INTEGER ? numero : Number.NaN;
  });
  const bloqueioOperacao = useRef(false);
  const [reconciliar, setReconciliar] = useState(false);

  const rascunhoEditavel = !!rodizio && rodizio.status === 'rascunho' && rodizio.travado === false;
  const bloquearItens = emOperacao || reconciliar || !rascunhoEditavel || !auxiliares || !Number.isSafeInteger(revisaoOriginal);
  const bloquearCabecalho = emOperacao || reconciliar || (!!rodizio && (!rascunhoEditavel || !Number.isSafeInteger(revisaoOriginal)));
  const itensAlterados = JSON.stringify(itens) !== JSON.stringify(itensInicial);
  const cabecalhoAlterado = !!rodizio && (titulo !== rodizio.titulo || dataInicio !== rodizio.data_inicio || dataFim !== rodizio.data_fim || observacoes !== (rodizio.observacoes ?? ''));

  // =========================================================================
  // Gestão de itens
  // =========================================================================

  const adicionarItem = () => {
    if (bloquearItens) return;
    const novoItem: RodizioItemInput = {
      data: rodizio?.data_inicio ?? '',
      porta: PORTAS_GERACAO_NEON[0].nome,
      periodo: null,
      auxiliar_id: null,
      observacoes: null,
    };
    setItens(prev => [...prev, novoItem]);
  };

  const editarItem = (index: number, alteracao: Partial<RodizioItemInput>) => {
    if (bloquearItens) return;
    setItens(prev => prev.map((item, i) => i === index ? { ...item, ...alteracao } : item));
  };

  const removerItem = (index: number) => {
    if (bloquearItens) return;
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  // =========================================================================
  // Operações P0
  // =========================================================================

  async function executarOperacao<T>(
    nome: string,
    operacao: () => Promise<{ data: T | null; error: string | null; novaRevisao?: number }>,
  ) {
    if (bloqueioOperacao.current || reconciliar) return;
    if (rodizio && !Number.isSafeInteger(revisaoOriginal)) {
      setErro('Revisão original indisponível. Reabra a escala.');
      return;
    }
    bloqueioOperacao.current = true;
    setErro(null);
    setSucesso(null);
    setEmOperacao(true);
    setOperacaoAtual(nome);

    try {
      const resultado = await operacao();
      if (resultado.error || resultado.data == null || resultado.data === false) {
        const mensagem = resultado.error || 'Resposta sem confirmação da operação. Confira a lista antes de repetir.';
        setReconciliar(true);
        setErro(mensagem + ' Feche e reabra a escala antes de nova tentativa.');
        onErro?.(mensagem);
      } else {
        setReconciliar(true);
        const msg = `Operação "${nome}" concluída com sucesso!`;
        setSucesso(msg);
        setNovaRevisao(resultado.novaRevisao ?? null);
        onSucesso?.(msg, resultado.novaRevisao);
      }
    } catch (err) {
      setReconciliar(true);
      const msg = `Erro inesperado em "${nome}": ${err instanceof Error ? err.message : String(err)}`;
      setErro(msg);
      onErro?.(msg);
    } finally {
      // Uma tentativa por abertura; a revisão original não pode ser reutilizada.
      setEmOperacao(false);
      setOperacaoAtual(null);
    }
  }

  /**
   * P0.1 — Criar rascunho
   */
  async function handleCriarRascunho() {
    const entrada: CriacaoRascunhoNeon = {
      titulo: titulo.trim(),
      dataInicio,
      dataFim,
      observacoes: observacoes.trim() || null,
    };

    if (!entrada.titulo || !entrada.dataInicio || !entrada.dataFim) {
      setErro('Título e datas são obrigatórios.');
      return;
    }

    await executarOperacao('Criar rascunho', () => criarRascunhoNeonEditor(entrada));
  }

  /**
   * P0.2 — Atualizar cabeçalho (separadamente dos itens)
   */
  async function handleAtualizarCabecalho() {
    if (bloquearCabecalho || itensAlterados) return;
    if (!rodizio) {
      setErro('Rodízio não carregado. Recarregue e tente novamente.');
      return;
    }

    const entrada: AtualizacaoCabecalhoNeon = {
      rodizioId: rodizio.id,
      revisaoOriginal,
      titulo: titulo.trim(),
      dataInicio,
      dataFim,
      observacoes: observacoes.trim() || null,
    };

    if (!entrada.titulo || !entrada.dataInicio || !entrada.dataFim) {
      setErro('Título e datas são obrigatórios.');
      return;
    }

    await executarOperacao('Atualizar cabeçalho', () =>
      atualizarCabecalhoNeonEditor(entrada),
    );
  }

  /**
   * P0.3 — Substituir itens (separadamente do cabeçalho)
   */
  async function handleSubstituirItens() {
    if (bloquearItens || cabecalhoAlterado) return;
    if (!rodizio) {
      setErro('Rodízio não carregado. Recarregue e tente novamente.');
      return;
    }

    if (itens.length === 0) {
      setErro('Informe pelo menos um item.');
      return;
    }

    if (itens.some(i => !i.data || i.data < rodizio.data_inicio || i.data > rodizio.data_fim || !i.porta.trim() || (i.auxiliar_id && !auxiliares?.some(a => a.id === i.auxiliar_id)))) {
      setErro('Revise datas, portas e auxiliares antes de salvar.'); return;
    }
    const entrada: SubstituicaoItensNeon = {
      rodizioId: rodizio.id,
      itens,
      revisaoOriginal,
    };

    await executarOperacao('Substituir itens', () =>
      substituirItensNeonEditor(entrada),
    );
  }

  /**
   * P0.4 — Publicar rodízio
   */
  async function handlePublicar() {
    if (!rascunhoEditavel || itensAlterados || cabecalhoAlterado || itensInicial.length === 0) return;
    if (!rodizio) {
      setErro('Rodízio não carregado. Recarregue e tente novamente.');
      return;
    }

    if (!confirm('Publicar esta escala? Esta ação não pode ser desfeita.')) {
      return;
    }

    const entrada: TransicaoEstadoNeon = {
      rodizioId: rodizio.id,
      revisaoOriginal,
      acao: 'publicar',
    };

    await executarOperacao('Publicar', () => publicarRodizioNeonEditor(entrada));
  }

  /**
   * P0.5 — Travar rodízio
   */
  async function handleTravar() {
    if (rodizio?.status !== 'publicado' || rodizio.travado) return;
    if (!rodizio) {
      setErro('Rodízio não carregado. Recarregue e tente novamente.');
      return;
    }

    if (!confirm('Travar esta escala? Esta ação não pode ser desfeita.')) {
      return;
    }

    const entrada: TransicaoEstadoNeon = {
      rodizioId: rodizio.id,
      revisaoOriginal,
      acao: 'travar',
    };

    await executarOperacao('Travar', () => travarRodizioNeonEditor(entrada));
  }

  /**
   * P0.6 — Cancelar rodízio
   */
  async function handleCancelar() {
    if (!rodizio || rodizio.travado || !['rascunho', 'publicado'].includes(rodizio.status) || itensAlterados || cabecalhoAlterado) return;
    if (!rodizio) {
      setErro('Rodízio não carregado. Recarregue e tente novamente.');
      return;
    }

    if (!confirm('Cancelar esta escala? Esta ação não pode ser desfeita.')) {
      return;
    }

    const entrada: CancelamentoNeon = {
      rodizioId: rodizio.id,
      revisaoOriginal,
    };

    await executarOperacao('Cancelar', () => cancelarRodizioNeonEditor(entrada));
  }

  /**
   * P0.7 — Excluir rascunho
   */
  async function handleExcluirRascunho() {
    if (!rascunhoEditavel || itensAlterados || cabecalhoAlterado) return;
    if (!rodizio) {
      setErro('Rodízio não carregado. Recarregue e tente novamente.');
      return;
    }

    if (!confirm('Excluir este rascunho permanentemente?')) {
      return;
    }

    const entrada: ExclusaoRascunhoNeon = {
      rodizioId: rodizio.id,
      revisaoOriginal,
    };

    await executarOperacao('Excluir rascunho', () =>
      excluirRascunhoNeonEditor(entrada),
    );
  }

  // =========================================================================
  // Renderização
  // =========================================================================

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between border-b">
          <div>
            <h2 className="text-xl font-bold">Editor de Rodízio Neon</h2>
            {rodizio && (
              <p className="text-sm text-blue-100 mt-1">
                ID: {rodizio.id.substring(0, 8)}... | Revisão: {novaRevisao ?? (Number.isSafeInteger(revisaoOriginal) ? revisaoOriginal : 'indisponível')}
              </p>
            )}
          </div>
          <button
            onClick={onFechar}
            disabled={emOperacao}
            className="p-2 hover:bg-blue-500 rounded disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 flex gap-0 bg-slate-50">
          <button
            onClick={() => setVista('editar')}
            className={`flex-1 py-3 px-6 font-medium text-sm border-b-2 transition ${
              vista === 'editar'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Editar
          </button>
          <button
            disabled={bloquearItens || cabecalhoAlterado}
            onClick={() => setVista('gerar')}
            className={`flex-1 py-3 px-6 font-medium text-sm border-b-2 transition flex items-center justify-center gap-2 ${
              vista === 'gerar'
                ? 'border-yellow-600 text-yellow-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap size={18} />
            Gerar
          </button>
        </div>

        {/* Alertas */}
        {erro && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-red-800">Erro</h3>
                <p className="text-sm text-red-700 mt-1">{erro}</p>
              </div>
            </div>
          </div>
        )}

        {sucesso && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 m-4">
            <div className="flex items-start gap-3">
              <Check className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">Sucesso</h3>
                <p className="text-sm text-green-700 mt-1">{sucesso}</p>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="p-6 space-y-6">
          {/* Vista: Gerar */}
          {vista === 'gerar' && rodizio && !bloquearItens && !cabecalhoAlterado && (
            <NeonRodizioGerador
              rodizio={rodizio}
              onGerado={(itensGerados) => {
                if (bloquearItens || cabecalhoAlterado) return;
                setItens(itensGerados);
                setVista('editar');
                setSucesso('Itens gerados com sucesso! Agora é possível editar antes de salvar.');
              }}
              onErro={(msg) => {
                setErro(msg);
              }}
            />
          )}

          {/* Vista: Editar */}
          {vista === 'editar' && (
            <>
          {/* Seção: Cabeçalho */}
          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ChevronDown size={20} />
              Cabeçalho do Rodízio
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  disabled={bloquearCabecalho}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    disabled={bloquearCabecalho}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    disabled={bloquearCabecalho}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  disabled={bloquearCabecalho}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                />
              </div>

              {rodizio && (
                <button
                  onClick={handleAtualizarCabecalho}
                  disabled={bloquearCabecalho || itensAlterados}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 flex items-center justify-center gap-2 transition"
                >
                  <Save size={18} />
                  P0.2 — Atualizar Cabeçalho
                </button>
              )}

              {!rodizio && (
                <button
                  onClick={handleCriarRascunho}
                  disabled={bloquearCabecalho}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 flex items-center justify-center gap-2 transition"
                >
                  <Send size={18} />
                  P0.1 — Criar Rascunho
                </button>
              )}
            </div>
          </section>

          {/* Seção: Itens */}
          {rodizio && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Itens da Escala</h3>
                <button
                  onClick={adicionarItem}
                  disabled={bloquearItens}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 text-sm"
                >
                  + Adicionar Item
                </button>
              </div>

              {erroAuxiliares && <p role="alert" className="text-red-700">{erroAuxiliares}</p>}
              {!auxiliares && !erroAuxiliares && <p>Carregando auxiliares...</p>}
              {(itensAlterados || cabecalhoAlterado) && <p className="text-sm text-amber-800">Salve um grupo de alterações por vez e reabra a escala. Alterações de cabeçalho e itens não são uma única transação.</p>}
              <div className="space-y-3 max-h-80 overflow-y-auto border rounded-lg p-4 bg-slate-50">
                {itens.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nenhum item. Adicione um para começar.</p>
                ) : (
                  itens.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-3 rounded border border-slate-200 flex justify-between items-start gap-3"
                    >
                      <fieldset disabled={bloquearItens} className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm min-w-0">
                        <label>Data<input aria-label="Data do item" type="date" min={rodizio.data_inicio} max={rodizio.data_fim} value={item.data} onChange={e => editarItem(idx, { data: e.target.value })} className="block w-full border rounded p-2" /></label>
                        <label>Porta<select aria-label="Porta do item" value={item.porta} onChange={e => editarItem(idx, { porta: e.target.value })} className="block w-full border rounded p-2">
                          <option value="">Selecione</option>
                          {!PORTAS_GERACAO_NEON.some(p => p.nome === item.porta) && item.porta && <option value={item.porta}>{item.porta}</option>}
                          {PORTAS_GERACAO_NEON.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                        </select></label>
                        <label>Auxiliar<select aria-label="Auxiliar do item" value={item.auxiliar_id ?? ''} onChange={e => editarItem(idx, { auxiliar_id: e.target.value || null })} className="block w-full border rounded p-2">
                          <option value="">Sem auxiliar</option>
                          {item.auxiliar_id && !auxiliares?.some(a => a.id === item.auxiliar_id) && <option value={item.auxiliar_id}>Auxiliar não localizada</option>}
                          {auxiliares?.filter(a => a.ativa || a.id === item.auxiliar_id).map(a => <option key={a.id} value={a.id}>{a.nome}{a.ativa ? '' : ' (inativa)'}</option>)}
                        </select></label>
                        <label>Período<input aria-label="Período do item" value={item.periodo ?? ''} onChange={e => editarItem(idx, { periodo: e.target.value || null })} className="block w-full border rounded p-2" /></label>
                        <label className="sm:col-span-2">Observações<input aria-label="Observações do item" value={item.observacoes ?? ''} onChange={e => editarItem(idx, { observacoes: e.target.value || null })} className="block w-full border rounded p-2" /></label>
                      </fieldset>
                      <div className="flex gap-2">
                        <button
                          onClick={() => removerItem(idx)}
                          disabled={bloquearItens}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={handleSubstituirItens}
                disabled={bloquearItens || cabecalhoAlterado || itens.length === 0}
                className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 flex items-center justify-center gap-2 transition"
              >
                <Save size={18} />
                P0.3 — Salvar Itens ({itens.length})
              </button>
            </section>
          )}

          {/* Seção: Transições de Estado */}
          {rodizio && (
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Transições de Estado</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePublicar}
                  disabled={bloquearCabecalho || itensAlterados || cabecalhoAlterado || itensInicial.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 flex items-center justify-center gap-2 transition text-sm"
                >
                  <Send size={16} />
                  P0.4 — Publicar
                </button>

                <button
                  onClick={handleTravar}
                  disabled={emOperacao || reconciliar || rodizio.travado || rodizio.status !== 'publicado'}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-slate-400 flex items-center justify-center gap-2 transition text-sm"
                >
                  <Lock size={16} />
                  P0.5 — Travar
                </button>

                <button
                  onClick={handleCancelar}
                  disabled={emOperacao || reconciliar || rodizio.travado || !['rascunho', 'publicado'].includes(rodizio.status) || itensAlterados || cabecalhoAlterado}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-400 flex items-center justify-center gap-2 transition text-sm"
                >
                  <AlertCircle size={16} />
                  P0.6 — Cancelar
                </button>

                <button
                  onClick={handleExcluirRascunho}
                  disabled={bloquearCabecalho || itensAlterados || cabecalhoAlterado}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-400 flex items-center justify-center gap-2 transition text-sm"
                >
                  <Trash2 size={16} />
                  P0.7 — Excluir
                </button>
              </div>
            </section>
          )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-100 border-t p-4 flex justify-end gap-3">
          <button
            onClick={onFechar}
            disabled={emOperacao}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        {/* Loading */}
        {emOperacao && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 rounded-lg">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="font-medium text-slate-900">{operacaoAtual}</p>
              <p className="text-sm text-slate-600">Processando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
