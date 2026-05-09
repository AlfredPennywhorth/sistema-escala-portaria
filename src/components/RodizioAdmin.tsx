import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Lock, 
  Trash2, 
  Eye,
  Send,
  AlertCircle,
  Check,
  LogIn,
  UserX,
  Sparkles,
  X,
  Save,
  AlertTriangle,
  TrendingUp,
  History,
  Trash,
  Clock
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../utils/cn';
import { useAuth } from '../hooks/useAuth';
import * as rodiziosService from '../services/rodiziosService';
import * as auxiliaresService from '../services/auxiliaresService';
import * as restricoesService from '../services/restricoesService';
import type { Rodizio, RodizioItem, Auxiliar } from '../types/supabase';
import { 
  podePublicarRodizio,
  podeTravarRodizio,
  podeExcluirRodizio,
  getStatusLabel
} from '../domain/rodizioStatus';
import { gerarRodizioEquilibrado } from '../domain/gerarRodizioEquilibrado';
import type { EntradaGeracaoRodizio, ItemRodizioSugerido, AlertaGeracaoRodizio, MetricaEquilibrioAuxiliar, ViolacaoRestricao, RestricaoConsiderada } from '../types/geracaoRodizio';
import { LoginSupabase } from './LoginSupabase';
import type { RegistroHistoricoInput } from '../services/rodiziosService';

const DIAS_ATIVOS = ['Domingo', 'Terça-Feira', 'Sábado'];

interface SugestaoPreview {
  itens: ItemRodizioSugerido[];
  alertas: AlertaGeracaoRodizio[];
  metricas: MetricaEquilibrioAuxiliar[];
  violacoes: ViolacaoRestricao[];
  restricoesConsideradas: RestricaoConsiderada[];
  rodizioId: string;
  rodizioTitulo: string;
}

interface ItemComAuxiliar {
  id: string;
  data: string;
  porta: string;
  periodo: string | null;
  auxiliar_id: string | null;
  observacoes: string | null;
  created_at: string;
  rodizio_id: string;
  auxiliar?: {
    id: string;
    nome: string;
    telefone?: string | null;
  };
}

interface ItemHistoricoTemporario {
  id: string;
  data: string;
  porta: string;
  auxiliarId: string;
  auxiliarNome: string;
  observacoes: string;
}

const LOCAIS = [
  { id: 'l1', nome: 'Entrada' },
  { id: 'l2', nome: 'Galeria' },
  { id: 'l3', nome: 'Lateral' },
  { id: 'l4', nome: 'Sanitário' },
];

export function RodizioAdmin() {
  const { usuario, isAdmin, loading: loadingAuth } = useAuth();
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [rodizios, setRodizios] = useState<Rodizio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formTitulo, setFormTitulo] = useState('');
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formDataFim, setFormDataFim] = useState('');
  const [mostrarItens, setMostrarItens] = useState<string | null>(null);
  const [itens, setItens] = useState<RodizioItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [gerandoSugestao, setGerandoSugestao] = useState(false);
  const [acaoSucesso, setAcaoSucesso] = useState<string | null>(null);
  const [previewSugestao, setPreviewSugestao] = useState<SugestaoPreview | null>(null);
  const [salvandoSugestao, setSalvandoSugestao] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [auxiliares, setAuxiliares] = useState<Auxiliar[]>([]);
  const [itensHistorico, setItensHistorico] = useState<ItemHistoricoTemporario[]>([]);
  const [mesAnoHistorico, setMesAnoHistorico] = useState('');
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setErro('Timeout ao verificar permissões. Recarregue a página.');
    }, 15000);
    
    carregarRodizios();
    
    return () => clearTimeout(timeout);
  }, [loadingAuth]);

  async function carregarRodizios() {
    setCarregando(true);
    setErro(null);
    const result = await rodiziosService.listarRodizios();
    if (result.error) {
      setErro(result.error);
    } else {
      setRodizios(result.data || []);
    }
    setCarregando(false);
  }

  async function carregarItens(rodizioId: string) {
    setCarregandoItens(true);
    const result = await rodiziosService.obterRodizioComItens(rodizioId);
    if (result.error) {
      setErro(result.error);
    } else if (result.data) {
      setItens(result.data.itens);
    }
    setCarregandoItens(false);
  }

  async function handleSalvar() {
    if (!formTitulo || !formDataInicio || !formDataFim) return;

    const result = await rodiziosService.criarRodizio({
      titulo: formTitulo,
      data_inicio: formDataInicio,
      data_fim: formDataFim,
    });
    if (result.error) {
      setErro(result.error);
    } else {
      setAcaoSucesso('Rodízio criado com sucesso!');
      resetForm();
      carregarRodizios();
      setTimeout(() => setAcaoSucesso(null), 3000);
    }
  }

  async function handlePublicar(id: string) {
    const result = await rodiziosService.publicarRodizio(id);
    if (result.error) {
      setErro(result.error);
    } else {
      setAcaoSucesso('Rodízio publicado com sucesso!');
      carregarRodizios();
      setTimeout(() => setAcaoSucesso(null), 3000);
    }
  }

  async function handleTravar(id: string) {
    const result = await rodiziosService.travarRodizio(id);
    if (result.error) {
      setErro(result.error);
    } else {
      setAcaoSucesso('Rodízio travado com sucesso!');
      carregarRodizios();
      setTimeout(() => setAcaoSucesso(null), 3000);
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este rodízio?')) return;
    const result = await rodiziosService.excluirRodizioRascunho(id);
    if (result.error) {
      setErro(result.error);
    } else {
      setAcaoSucesso('Rodízio excluído!');
      carregarRodizios();
      setTimeout(() => setAcaoSucesso(null), 3000);
    }
  }

async function handleGerarSugestao(rodizio: Rodizio) {
    console.log('[DEBUG] handleGerarSugestao iniciado para rodizio:', rodizio.id);
    setGerandoSugestao(true);
    setErro(null);
    try {
      const historicoResult = await rodiziosService.listarRodiziosTravadosComItens();
      const auxiliaresResult = await auxiliaresService.listarAuxiliares(false);
      const restricoesResult = await restricoesService.listarRestricoes({});
      
      console.log('[DEBUG] historicoResult:', historicoResult);
      console.log('[DEBUG] auxiliaresResult:', auxiliaresResult);
      console.log('[DEBUG] restricoesResult:', restricoesResult);
      
      if (historicoResult.error || !historicoResult.data) {
        setErro('Erro ao carregar histórico de rodízios.');
        setGerandoSugestao(false);
        return;
      }
      
      if (auxiliaresResult.error || !auxiliaresResult.data) {
        setErro('Erro ao carregar auxiliares.');
        setGerandoSugestao(false);
        return;
      }

      if (auxiliaresResult.data.length === 0) {
        setErro('Não há auxiliares ativas no sistema. Cadastre auxiliares primeiro.');
        setGerandoSugestao(false);
        return;
      }

      const entrada: EntradaGeracaoRodizio = {
        dataInicio: rodizio.data_inicio,
        dataFim: rodizio.data_fim,
        portas: LOCAIS,
        diasAtivos: DIAS_ATIVOS,
        auxiliares: auxiliaresResult.data.map(a => ({
          id: a.id,
          nome: a.nome,
          ativa: a.ativa,
        })),
        restricoes: restricoesResult.data?.map(r => ({
          id: r.id,
          auxiliarId: r.auxiliar_id,
          data: r.data,
          dia_semana: r.dia_semana,
          porta: r.porta,
          tipo: r.tipo as 'indisponivel' | 'preferencia' | 'evitar' | 'observacao',
          motivo: r.motivo,
          ativa: r.ativa,
        })) || [],
        historicoTravado: historicoResult.data,
      };

      console.log('[DEBUG] entrada para gerarRodizioEquilibrado:', JSON.stringify(entrada, null, 2));
      const resultado = gerarRodizioEquilibrado(entrada);
      console.log('[DEBUG] resultado da geração:', JSON.stringify(resultado, null, 2));

      if (resultado.itens.length === 0) {
        setErro('Não foi possível gerar itens. Verifique: auxiliares ativas, portas configuradas e período do rodízio.');
        setGerandoSugestao(false);
        return;
      }

      const novoPreview: SugestaoPreview = {
        itens: resultado.itens,
        alertas: resultado.alertas,
        metricas: resultado.metricas,
        violacoes: resultado.violacoes,
        restricoesConsideradas: resultado.restricoesConsideradas,
        rodizioId: rodizio.id,
        rodizioTitulo: rodizio.titulo,
      };
      console.log('[DEBUG] novoPreview:', JSON.stringify(novoPreview, null, 2));
      setPreviewSugestao(novoPreview);
    } catch (err) {
      console.error('[DEBUG] Erro no catch:', err);
      setErro('Erro ao gerar sugestão de equilíbrio.');
    }
    setGerandoSugestao(false);
  }

  async function handleSalvarSugestao() {
    if (!previewSugestao) return;

    setSalvandoSugestao(true);
    try {
      const itensParaSalvar = previewSugestao.itens.map(item => ({
        data: item.data,
        porta: item.porta,
        periodo: item.periodo || null,
        auxiliar_id: item.auxiliarId,
        observacoes: item.motivoSelecao.length > 0 ? item.motivoSelecao.join('; ') : null,
      }));

      const result = await rodiziosService.salvarItensRodizio(previewSugestao.rodizioId, itensParaSalvar);

      if (result.error) {
        setErro('Erro ao salvar sugestão: ' + result.error);
      } else {
        setAcaoSucesso(`Sugestão salva com ${previewSugestao.itens.length} itens!`);
        setPreviewSugestao(null);
        carregarItens(previewSugestao.rodizioId);
        setTimeout(() => setAcaoSucesso(null), 5000);
      }
    } catch {
      setErro('Erro ao salvar sugestão.');
    }
    setSalvandoSugestao(false);
  }

  function resetForm() {
    setMostrarForm(false);
    setFormTitulo('');
    setFormDataInicio('');
    setFormDataFim('');
  }

  async function abrirModalHistorico() {
    const result = await auxiliaresService.listarAuxiliares(false);
    if (result.error || !result.data) {
      setErro('Erro ao carregar auxiliares.');
      return;
    }
    setAuxiliares(result.data);
    setItensHistorico([]);
    const now = new Date();
    setMesAnoHistorico(`${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
    setMostrarHistorico(true);
  }

  function adicionarItemHistorico() {
    const novoItem: ItemHistoricoTemporario = {
      id: crypto.randomUUID(),
      data: '',
      porta: LOCAIS[0].nome,
      auxiliarId: '',
      auxiliarNome: '',
      observacoes: '',
    };
    setItensHistorico([...itensHistorico, novoItem]);
  }

  function removerItemHistorico(id: string) {
    setItensHistorico(itensHistorico.filter(item => item.id !== id));
  }

  function atualizarItemHistorico(id: string, campo: string, valor: string) {
    setItensHistorico(itensHistorico.map(item => 
      item.id === id ? { ...item, [campo]: valor } as ItemHistoricoTemporario : item
    ));
  }

  async function handleSalvarHistorico() {
    if (!mesAnoHistorico) {
      setErro('Informe o mês/ano do histórico (ex: 05/2026)');
      return;
    }

    if (auxiliares.length === 0) {
      setErro('Não há auxiliares ativas no sistema. Cadastre auxiliares primeiro.');
      return;
    }

    const itensValidos = itensHistorico.filter(item => 
      item.data && item.porta && item.auxiliarId
    );

    if (itensValidos.length === 0) {
      setErro('Adicione pelo menos um item com data, porta e auxiliar preenchidos.');
      return;
    }

    const itensInvalidos = itensHistorico.filter(item => 
      !item.data || !item.porta || !item.auxiliarId
    );

    if (itensInvalidos.length > 0) {
      setErro(`Atenção: ${itensInvalidos.length} item(ns) não foram salvos por falta de dados (data, porta ou auxiliar). Remova-os ou preencha os campos obrigatórios.`);
      return;
    }

    const itensParaSalvar: RegistroHistoricoInput[] = itensValidos.map(item => ({
      data: item.data,
      porta: item.porta,
      auxiliar_id: item.auxiliarId,
      observacoes: item.observacoes || null,
    }));

    setSalvandoHistorico(true);
    setErro(null);
    const result = await rodiziosService.registrarHistoricoRealizado(mesAnoHistorico, itensParaSalvar);
    
    if (result.error) {
      setErro('Erro ao salvar histórico: ' + result.error);
    } else {
      setAcaoSucesso(`Histórico salvo com ${itensValidos.length} escalas realizadas!`);
      setMostrarHistorico(false);
      setItensHistorico([]);
      carregarRodizios();
    }
    setSalvandoHistorico(false);
  }

  function calcularResumoPorAuxiliar(itens: ItemRodizioSugerido[]) {
    const resumo: Record<string, Record<string, number>> = {};
    
    for (const item of itens) {
      const nome = item.auxiliarNome;
      if (!resumo[nome]) {
        resumo[nome] = { Entrada: 0, Galeria: 0, Lateral: 0, Sanitário: 0, Total: 0 };
      }
      if (resumo[nome][item.porta] !== undefined) {
        resumo[nome][item.porta]++;
        resumo[nome].Total++;
      }
    }
    
    return resumo;
  }

  function toggleItens(rodizioId: string) {
    if (mostrarItens === rodizioId) {
      setMostrarItens(null);
      setItens([]);
    } else {
      setMostrarItens(rodizioId);
      carregarItens(rodizioId);
    }
  }

  function getStatusBadgeColor(status: string, travado: boolean): string {
    if (travado) return 'bg-green-100 text-green-700 border-green-200';
    switch (status) {
      case 'rascunho': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'publicado': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelado': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Faça Login</h2>
          <p className="text-slate-600 mb-6">
            Esta área é exclusiva para administradores. Faça login para continuar.
          </p>
          <button
            onClick={() => setMostrarLogin(true)}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
          >
            Entrar
          </button>
          
          {mostrarLogin && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md relative">
                <button
                  onClick={() => setMostrarLogin(false)}
                  className="absolute -top-8 right-0 p-2 text-white hover:text-gray-200"
                >
                  ✕ Fechar
                </button>
                <LoginSupabase onClose={() => setMostrarLogin(false)} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Sem Permissão</h2>
          <p className="text-slate-600 mb-4">
            Você está logado como <strong>{usuario.email}</strong>, mas não possui perfil de administrador.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Para ter acesso, um admin precisa vincular seu usuário à tabela <code>usuarios_auxiliares</code> com perfil <code>admin</code>.
          </p>
          <div className="bg-slate-100 rounded-lg p-4 text-left">
            <p className="text-xs font-mono text-slate-600">
              SQL para adicionar: INSERT INTO usuarios_auxiliares (user_id, perfil) VALUES ('{usuario.id}', 'admin');
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Carregando rodízios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Rodízios</h1>
          <p className="text-slate-500 font-medium">Gerencie rodízios de escala de portaria.</p>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Novo Rodízio
        </button>
        <button
          onClick={abrirModalHistorico}
          title="Cadastre escalas já realizadas para o algoritmo considerar no equilíbrio"
          className="px-5 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all flex items-center gap-2 border-2 border-amber-600"
        >
          <History className="w-5 h-5" />
          <span>Lançar Escala Realizada</span>
        </button>
      </header>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-red-800">Erro</p>
            <p className="text-sm text-red-600">{erro}</p>
            <button onClick={() => setErro(null)} className="text-sm text-red-700 font-medium mt-2">Fechar</button>
          </div>
        </div>
      )}

      {acaoSucesso && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-green-700 font-medium">{acaoSucesso}</p>
        </div>
      )}

      {mostrarHistorico && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-amber-600 to-amber-700 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6" />
                <h2 className="text-xl font-bold">Lançar Histórico Realizado</h2>
              </div>
              <button
                onClick={() => setMostrarHistorico(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Mês/Ano (ex: 05/2026)</label>
                  <input
                    type="text"
                    value={mesAnoHistorico}
                    onChange={e => setMesAnoHistorico(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="MM/AAAA"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">Para que serve esta tela?</p>
                <p>Use esta tela para registrar escalas que já aconteceram antes de gerar o restante do mês. 
                   Esses lançamentos entram como histórico travado e serão considerados no equilíbrio, 
                   evitando sobrecarregar quem já trabalhou.</p>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">Itens do histórico ({itensHistorico.length})</p>
                <button
                  onClick={adicionarItemHistorico}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Adicionar Item
                </button>
              </div>

              {itensHistorico.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="font-medium">Nenhum item adicionado</p>
                  <p className="text-sm">Clique em "Adicionar Item" para cadastrar escalas já realizadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itensHistorico.map(item => (
                    <div key={item.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Data</label>
                          <input
                            type="date"
                            value={item.data}
                            onChange={e => atualizarItemHistorico(item.id, 'data', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Porta/Local</label>
                          <select
                            value={item.porta}
                            onChange={e => atualizarItemHistorico(item.id, 'porta', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          >
                            {LOCAIS.map(loc => (
                              <option key={loc.id} value={loc.nome}>{loc.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Auxiliar</label>
                          <select
                            value={item.auxiliarId}
                            onChange={e => {
                              const auxiliarSelecionada = auxiliares.find(a => a.id === e.target.value);
                              const novoNome = auxiliarSelecionada?.nome || '';
                              
                              setItensHistorico(itensHistorico.map(i => 
                                i.id === item.id 
                                  ? { ...i, auxiliarId: e.target.value, auxiliarNome: novoNome }
                                  : i
                              ));
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          >
                            <option value="">Selecione...</option>
                            {auxiliares.map(a => (
                              <option key={a.id} value={a.id}>{a.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            onClick={() => removerItemHistorico(item.id)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <input
                          type="text"
                          value={item.observacoes}
                          onChange={e => atualizarItemHistorico(item.id, 'observacoes', e.target.value)}
                          placeholder="Observações (opcional)"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setMostrarHistorico(false)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarHistorico}
                  disabled={salvandoHistorico || itensHistorico.length === 0}
                  className="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {salvandoHistorico ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Histórico
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewSugestao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6" />
                <h2 className="text-xl font-bold">Sugestão Equilibrada</h2>
              </div>
              <button
                onClick={() => setPreviewSugestao(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Rodízio</p>
                  <p className="font-bold text-slate-800">{previewSugestao.rodizioTitulo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total de itens</p>
                  <p className="font-bold text-2xl text-blue-600">{previewSugestao.itens.length}</p>
                </div>
              </div>

              {previewSugestao.alertas.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <p className="font-semibold text-amber-800">Alertas ({previewSugestao.alertas.length})</p>
                  </div>
                  <ul className="space-y-1">
                    {previewSugestao.alertas.map((alerta, idx) => (
                      <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                        <span className="font-mono text-xs bg-amber-100 px-1 rounded">{alerta.tipo}</span>
                        {alerta.mensagem}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previewSugestao.restricoesConsideradas.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-purple-600" />
                    <p className="font-semibold text-purple-800">Restrições Consideradas ({previewSugestao.restricoesConsideradas.length})</p>
                  </div>
                  <div className="space-y-2">
                    {previewSugestao.restricoesConsideradas.map((restricao, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-purple-100 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{restricao.auxiliarNome}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            restricao.tipo === 'indisponivel' ? 'bg-red-100 text-red-700' :
                            restricao.tipo === 'evitar' ? 'bg-amber-100 text-amber-700' :
                            restricao.tipo === 'preferencia' ? 'bg-green-100 text-green-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {restricao.tipo}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {restricao.porta && `Porta: ${restricao.porta}`}
                          {restricao.dia_semana !== null && ` | Dia: ${(restricao.dia_semana as number) === 0 ? 'Dom' : (restricao.dia_semana as number) === 1 ? 'Seg' : (restricao.dia_semana as number) === 2 ? 'Ter' : (restricao.dia_semana as number) === 3 ? 'Qua' : (restricao.dia_semana as number) === 4 ? 'Qui' : (restricao.dia_semana as number) === 5 ? 'Sex' : 'Sáb'}`}
                          {restricao.data && ` | Data: ${restricao.data}`}
                        </p>
                        {restricao.motivo && (
                          <p className="text-xs text-slate-400 mt-1">Motivo: {restricao.motivo}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewSugestao.violacoes.length > 0 && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <p className="font-bold text-red-800 text-lg">Violações de Restrição Detectadas ({previewSugestao.violacoes.length})</p>
                  </div>
                  <p className="text-sm text-red-700 mb-3">
                    Existem restrições <strong>indisponíveis</strong> violadas. Ajuste as restrições ou gere novamente.
                  </p>
                  <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-red-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Data</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Porta</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Auxiliar</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Restrição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {previewSugestao.violacoes.map((violacao, idx) => (
                          <tr key={idx} className="bg-red-50">
                            <td className="px-3 py-2 font-medium text-slate-800">{violacao.data}</td>
                            <td className="px-3 py-2 text-slate-600">{violacao.porta}</td>
                            <td className="px-3 py-2 font-bold text-red-700">{violacao.auxiliar}</td>
                            <td className="px-3 py-2 text-red-600">{violacao.restricao}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewSugestao.metricas.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <p className="font-semibold text-green-800">Métricas de Equilíbrio</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {previewSugestao.metricas.map((metrica, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-green-100">
                        <p className="font-medium text-slate-800 text-sm">{metrica.auxiliarNome}</p>
                        <p className="text-xs text-slate-500">
                          Histórico: {metrica.totalHistorico} | Novo: {metrica.totalNovo} | Total: {metrica.totalGeral}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="font-semibold text-blue-800 mb-3">Resumo de Conferência por Local</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-blue-700">Auxiliar</th>
                        <th className="px-3 py-2 text-center font-semibold text-blue-700">Entrada</th>
                        <th className="px-3 py-2 text-center font-semibold text-blue-700">Galeria</th>
                        <th className="px-3 py-2 text-center font-semibold text-blue-700">Lateral</th>
                        <th className="px-3 py-2 text-center font-semibold text-blue-700">Sanitário</th>
                        <th className="px-3 py-2 text-center font-semibold text-blue-700">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {(() => {
                        const resumo = calcularResumoPorAuxiliar(previewSugestao.itens);
                        return Object.entries(resumo).map(([nome, contagens]) => (
                          <tr key={nome} className="bg-white">
                            <td className="px-3 py-2 font-medium text-slate-800">{nome}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{contagens.Entrada}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{contagens.Galeria}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{contagens.Lateral}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{contagens.Sanitário}</td>
                            <td className="px-3 py-2 text-center font-bold text-blue-600">{contagens.Total}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-600" />
                  Itens Sugeridos
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Data</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Porta</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Auxiliar</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewSugestao.itens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {format(parseISO(item.data), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.porta}</td>
                          <td className="px-4 py-3 font-medium text-blue-700">{item.auxiliarNome}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {item.motivoSelecao.length > 0 ? item.motivoSelecao.join(', ') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setPreviewSugestao(null)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarSugestao}
                  disabled={salvandoSugestao || previewSugestao.violacoes.length > 0}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={previewSugestao.violacoes.length > 0 ? 'Não é possível salvar com violações de restrição' : ''}
                >
                  {salvandoSugestao ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : previewSugestao.violacoes.length > 0 ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      Violações Impedem Salvamento
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar como Rascunho
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            Novo Rodízio
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Título</label>
              <input
                type="text"
                value={formTitulo}
                onChange={e => setFormTitulo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: Escala Janeiro 2025"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Data Início</label>
              <input
                type="date"
                value={formDataInicio}
                onChange={e => setFormDataInicio(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Data Fim</label>
              <input
                type="date"
                value={formDataFim}
                onChange={e => setFormDataFim(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSalvar}
              disabled={!formTitulo || !formDataInicio || !formDataFim}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {rodizios.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Nenhum rodízio encontrado</p>
            <p className="text-sm mt-1">Clique em "Novo Rodízio" para criar o primeiro.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Título</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Período</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rodizios.map(r => (
                <>
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {r.titulo.startsWith('Histórico Realizado') && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">
                            HISTÓRICO
                          </span>
                        )}
                        <p className="font-bold text-slate-800">{r.titulo}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Criado em {format(parseISO(r.created_at), "dd/MM/yyyy")}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">
                        {format(parseISO(r.data_inicio), "dd/MM/yyyy")} - {format(parseISO(r.data_fim), "dd/MM/yyyy")}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'px-3 py-1 rounded-lg text-xs font-bold border',
                        getStatusBadgeColor(r.status, r.travado)
                      )}>
                        {r.travado ? 'Travado' : getStatusLabel(r)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          onClick={() => toggleItens(r.id)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Ver itens"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {podePublicarRodizio(r) && (
                          <button
                            onClick={() => handlePublicar(r.id)}
                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Publicar"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        
                        {podeTravarRodizio(r) && (
                          <button
                            onClick={() => handleTravar(r.id)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Travar"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )}

                        {!r.travado && (
                          <button
                            onClick={() => handleGerarSugestao(r)}
                            disabled={gerandoSugestao}
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all disabled:opacity-50"
                            title="Gerar sugestão equilibrada"
                          >
                            {gerandoSugestao ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        
                        {podeExcluirRodizio(r) && (
                          <button
                            onClick={() => handleExcluir(r.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {mostrarItens === r.id && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 px-6 py-4">
                        {carregandoItens ? (
                          <div className="flex items-center gap-2 text-slate-500">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Carregando itens...
                          </div>
                        ) : itens.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-slate-500 text-sm mb-2">Este rodízio ainda não possui escala salva.</p>
                            <p className="text-blue-600 text-xs">Use "Gerar sugestão equilibrada" para criar uma sugestão.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-sm font-semibold text-slate-600">Itens ({itens.length})</p>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Data</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Porta</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Auxiliar</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Observações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {itens.map(item => (
                                    <tr key={item.id} className="bg-white hover:bg-slate-50">
                                      <td className="px-3 py-2 font-medium text-slate-800">
                                        {format(parseISO(item.data), 'dd/MM/yyyy')}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">{item.porta}</td>
                                      <td className="px-3 py-2 font-medium text-blue-700">
                                        {(item as ItemComAuxiliar).auxiliar?.nome || '-'}
                                      </td>
                                      <td className="px-3 py-2 text-slate-500 text-xs">
                                        {item.observacoes || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-xs font-semibold text-blue-800 mb-2">Resumo por Auxiliar</p>
                              <div className="space-y-1">
                                {(() => {
                                  const resumo: Record<string, { total: number; portas: Set<string> }> = {};
                                  for (const item of itens) {
                                    const nome = (item as ItemComAuxiliar).auxiliar?.nome || 'Desconhecido';
                                    if (!resumo[nome]) {
                                      resumo[nome] = { total: 0, portas: new Set() };
                                    }
                                    resumo[nome].total++;
                                    resumo[nome].portas.add(item.porta);
                                  }
                                  return Object.entries(resumo).map(([nome, dados]) => (
                                    <p key={nome} className="text-xs text-slate-700">
                                      <span className="font-medium">{nome}:</span> {dados.total} escalas ({dados.portas.size} portas)
                                    </p>
                                  ));
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}