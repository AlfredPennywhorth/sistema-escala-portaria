import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit3,
  AlertCircle,
  Check,
  Search,
  Phone,
  Mail,
  ToggleLeft,
  ToggleRight,
  Shield,
  X,
  Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../utils/cn';
import * as auxiliaresService from '../services/auxiliaresService';
import * as restricoesService from '../services/restricoesService';
import type { Auxiliar, RestricaoAuxiliar, RestricaoInput, TipoRestricao } from '../types/supabase';
import { DIAS_SEMANA, DIAS_SEMANA_OPCOES } from '../types/supabase';

const LOCAIS = ['Entrada', 'Galeria', 'Lateral', 'Sanitário'];

export function AuxiliaresAdmin() {
  const [auxiliares, setAuxiliares] = useState<Auxiliar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [filtro, setFiltro] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [restricoesModal, setRestricoesModal] = useState<{
    mostrar: boolean;
    auxiliar: Auxiliar | null;
    restricoes: RestricaoAuxiliar[];
    carregando: boolean;
    novaRestricao: {
      tipo: 'indisponivel' | 'evitar' | 'preferencia' | 'observacao';
      data: string;
      dia_semana: number | null;
      porta: string;
      motivo: string;
    };
  }>({
    mostrar: false,
    auxiliar: null,
    restricoes: [],
    carregando: false,
    novaRestricao: {
      tipo: 'indisponivel',
      data: '',
      dia_semana: null,
      porta: '',
      motivo: '',
    },
  });

  useEffect(() => {
    carregarAuxiliares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarInativas]);

  async function carregarAuxiliares() {
    setCarregando(true);
    setErro(null);
    const result = await auxiliaresService.listarAuxiliares(mostrarInativas);
    if (result.error) {
      setErro(result.error);
    } else {
      setAuxiliares(result.data || []);
    }
    setCarregando(false);
  }

  async function handleSalvar() {
    if (!formNome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }

    if (editandoId) {
      const result = await auxiliaresService.atualizarAuxiliar(editandoId, {
        nome: formNome.trim(),
        telefone: formTelefone || null,
        email: formEmail || null,
        observacoes: formObservacoes || null,
      });
      if (result.error) {
        setErro(result.error);
      } else {
        setSucesso('Auxiliar atualizada com sucesso!');
        resetForm();
        carregarAuxiliares();
        setTimeout(() => setSucesso(null), 3000);
      }
    } else {
      const result = await auxiliaresService.criarAuxiliar({
        nome: formNome.trim(),
        telefone: formTelefone || null,
        email: formEmail || null,
        observacoes: formObservacoes || null,
      });
      if (result.error) {
        setErro(result.error);
      } else {
        setSucesso('Auxiliar criada com sucesso!');
        resetForm();
        carregarAuxiliares();
        setTimeout(() => setSucesso(null), 3000);
      }
    }
  }

  async function handleDesativar(id: string) {
    const result = await auxiliaresService.desativarAuxiliar(id);
    if (result.error) {
      setErro(result.error);
    } else {
      setSucesso('Auxiliar desativada');
      carregarAuxiliares();
      setTimeout(() => setSucesso(null), 3000);
    }
  }

  async function handleReativar(id: string) {
    const result = await auxiliaresService.reativarAuxiliar(id);
    if (result.error) {
      setErro(result.error);
    } else {
      setSucesso('Auxiliar reativada');
      carregarAuxiliares();
      setTimeout(() => setSucesso(null), 3000);
    }
  }

  function resetForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setFormNome('');
    setFormTelefone('');
    setFormEmail('');
    setFormObservacoes('');
  }

  function editar(aux: Auxiliar) {
    setEditandoId(aux.id);
    setFormNome(aux.nome);
    setFormTelefone(aux.telefone || '');
    setFormEmail(aux.email || '');
    setFormObservacoes(aux.observacoes || '');
    setMostrarForm(true);
  }

  async function abrirModalRestricoes(aux: Auxiliar) {
    setRestricoesModal(prev => ({ ...prev, mostrar: true, auxiliar: aux, carregando: true }));
    
    const result = await restricoesService.listarRestricoes({ auxiliarId: aux.id, incluirInativas: true });
    
    if (result.error) {
      setErro(result.error);
      setRestricoesModal(prev => ({ ...prev, carregando: false }));
    } else {
      setRestricoesModal(prev => ({ ...prev, restricoes: result.data || [], carregando: false }));
    }
  }

  function fecharModalRestricoes() {
    setRestricoesModal(prev => ({ ...prev, mostrar: false, auxiliar: null, restricoes: [], novaRestricao: { tipo: 'indisponivel', data: '', dia_semana: null, porta: '', motivo: '' } }));
  }

  function atualizarNovaRestricao(campo: string, valor: string | number | null) {
    setRestricoesModal(prev => ({
      ...prev,
      novaRestricao: { ...prev.novaRestricao, [campo]: valor },
    }));
  }

  async function adicionarRestricao() {
    if (!restricoesModal.auxiliar) return;

    const { tipo, data, dia_semana, porta, motivo } = restricoesModal.novaRestricao;
    
    if (!tipo) {
      setErro('Selecione o tipo da restrição');
      return;
    }

    const input: RestricaoInput = {
      auxiliar_id: restricoesModal.auxiliar.id,
      tipo: tipo as TipoRestricao,
      motivo: motivo || null,
    };

    if (dia_semana !== null) {
      input.dia_semana = dia_semana;
    } else if (data) {
      input.data = data;
    } else {
      setErro('Informe a data ou selecione o dia da semana');
      return;
    }

    if (porta) {
      input.porta = porta;
    }

    const result = await restricoesService.criarRestricao(input);

    if (result.error) {
      setErro(result.error);
    } else {
      setSucesso('Restrição adicionada!');
      const listResult = await restricoesService.listarRestricoes({ auxiliarId: restricoesModal.auxiliar!.id, incluirInativas: true });
      setRestricoesModal(prev => ({
        ...prev,
        restricoes: listResult.data || [],
        novaRestricao: { tipo: 'indisponivel', data: '', dia_semana: null, porta: '', motivo: '' },
      }));
      setTimeout(() => setSucesso(null), 3000);
    }
  }

  async function removerRestricao(id: string) {
    if (!confirm('Deseja excluir esta restrição?')) return;

    const result = await restricoesService.excluirRestricao(id);

    if (result.error) {
      setErro(result.error);
    } else {
      setSucesso('Restrição removida!');
      setRestricoesModal(prev => ({
        ...prev,
        restricoes: prev.restricoes.filter(r => r.id !== id),
      }));
      setTimeout(() => setSucesso(null), 3000);
    }
  }

  function getTipoLabel(tipo: string): string {
    switch (tipo) {
      case 'indisponivel': return 'Bloqueio (não atende)';
      case 'evitar': return 'Evitar';
      case 'preferencia': return 'Preferência';
      case 'observacao': return 'Observação';
      default: return tipo;
    }
  }

  function getTipoCor(tipo: string): string {
    switch (tipo) {
      case 'indisponivel': return 'bg-red-100 text-red-700 border-red-200';
      case 'evitar': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'preferencia': return 'bg-green-100 text-green-700 border-green-200';
      case 'observacao': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  const auxiliaresFiltradas = auxiliares.filter(a => 
    a.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    (a.email && a.email.toLowerCase().includes(filtro.toLowerCase()))
  );

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Carregando auxiliares...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Auxiliares</h1>
          <p className="text-slate-500 font-medium">Gerencie auxiliares de portaria via Supabase.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setMostrarInativas(!mostrarInativas)}
            className={cn(
              "px-4 py-2 font-bold rounded-xl transition-all flex items-center gap-2",
              mostrarInativas 
                ? "bg-slate-200 text-slate-700" 
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            {mostrarInativas ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            Inativas
          </button>
          <button
            onClick={() => setMostrarForm(true)}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Nova Auxiliar
          </button>
        </div>
      </header>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Erro</p>
            <p className="text-sm text-red-600">{erro}</p>
          </div>
          <button onClick={() => setErro(null)} className="text-red-700 font-medium">✕</button>
        </div>
      )}

      {sucesso && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-green-700 font-medium">{sucesso}</p>
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            {editandoId ? 'Editar Auxiliar' : 'Nova Auxiliar'}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nome *</label>
              <input
                type="text"
                value={formNome}
                onChange={e => setFormNome(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" /> Telefone
              </label>
              <input
                type="tel"
                value={formTelefone}
                onChange={e => setFormTelefone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" /> Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Observações</label>
              <textarea
                value={formObservacoes}
                onChange={e => setFormObservacoes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={2}
                placeholder="Observações opcionais"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSalvar}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
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

      {restricoesModal.mostrar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6" />
                <h2 className="text-xl font-bold">Restrições de {restricoesModal.auxiliar?.nome}</h2>
              </div>
              <button
                onClick={fecharModalRestricoes}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">Como cadastrar restrições:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Bloqueio:</strong> Auxiliar NÃO atende neste dia/local.</li>
                  <li><strong>Evitar:</strong> Penalidade se escaladar neste dia/local.</li>
                  <li><strong>Preferência:</strong> Bônus se escaladar neste dia/local.</li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3">Nova Restrição</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo *</label>
                    <select
                      value={restricoesModal.novaRestricao.tipo}
                      onChange={e => atualizarNovaRestricao('tipo', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="indisponivel">Bloqueio (não atende)</option>
                      <option value="evitar">Evitar</option>
                      <option value="preferencia">Preferência</option>
                      <option value="observacao">Observação</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Local/Porta</label>
                    <select
                      value={restricoesModal.novaRestricao.porta}
                      onChange={e => atualizarNovaRestricao('porta', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="">Qualquer local</option>
                      {LOCAIS.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Dia da Semana</label>
                    <select
                      value={restricoesModal.novaRestricao.dia_semana ?? ''}
                      onChange={e => atualizarNovaRestricao('dia_semana', e.target.value === '' ? null : Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="">Selecione (opcional)</option>
                      {DIAS_SEMANA_OPCOES.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Data Específica</label>
                    <input
                      type="date"
                      value={restricoesModal.novaRestricao.data}
                      onChange={e => atualizarNovaRestricao('data', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Motivo/Observação</label>
                    <input
                      type="text"
                      value={restricoesModal.novaRestricao.motivo}
                      onChange={e => atualizarNovaRestricao('motivo', e.target.value)}
                      placeholder="Ex: Não trabalha Terça-feira"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={adicionarRestricao}
                  className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700"
                >
                  Adicionar Restrição
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Restrições Cadastradas ({restricoesModal.restricoes.length})</h3>
                {restricoesModal.restricoes.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma restrição cadastrada.</p>
                ) : (
                  <div className="space-y-2">
                    {restricoesModal.restricoes.map(r => (
                      <div key={r.id} className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        getTipoCor(r.tipo),
                        !r.ativa && "opacity-50"
                      )}>
                        <div>
                          <span className="font-semibold text-xs">{getTipoLabel(r.tipo)}</span>
                          <p className="text-sm mt-1">
                            {r.dia_semana !== null && r.dia_semana !== undefined 
                              ? `Todo ${DIAS_SEMANA[r.dia_semana as keyof typeof DIAS_SEMANA]}`
                              : r.data 
                                ? format(parseISO(r.data), 'dd/MM/yyyy')
                                : 'Sem data'}
                            {r.porta && ` - ${r.porta}`}
                          </p>
                          {r.motivo && <p className="text-xs mt-1 opacity-75">{r.motivo}</p>}
                        </div>
                        <button
                          onClick={() => removerRestricao(r.id)}
                          className="p-2 hover:bg-white/50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {auxiliaresFiltradas.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">Nenhuma auxiliar encontrada</p>
            <p className="text-sm mt-1">Clique em "Nova Auxiliar" para criar a primeira.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nome</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Contato</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auxiliaresFiltradas.map(a => (
                <tr key={a.id} className={cn(
                  "hover:bg-slate-50/50 transition-colors",
                  !a.ativa && "opacity-60 bg-slate-50"
                )}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                        {a.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{a.nome}</p>
                        {a.observacoes && (
                          <p className="text-xs text-slate-500 mt-0.5">{a.observacoes}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {a.telefone && (
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {a.telefone}
                        </p>
                      )}
                      {a.email && (
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {a.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold border',
                      a.ativa 
                        ? 'bg-green-100 text-green-700 border-green-200' 
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    )}>
                      {a.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button
                        onClick={() => abrirModalRestricoes(a)}
                        className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                        title="Restrições"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => editar(a)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {a.ativa ? (
                        <button
                          onClick={() => handleDesativar(a.id)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                          title="Desativar"
                        >
                          <ToggleRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReativar(a.id)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Reativar"
                        >
                          <ToggleLeft className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}