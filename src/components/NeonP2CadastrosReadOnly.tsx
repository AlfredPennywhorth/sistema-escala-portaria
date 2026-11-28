/**
 * Tela de leitura de cadastros P2 — Auxiliares e Restrições
 *
 * Implementa interface somente-leitura para:
 * - Listagem de auxiliares
 * - Listagem de restrições
 *
 * Mutações bloqueadas até aprovação específica de P2.
 * Sem fallback Supabase.
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Users, Lock, ChevronDown } from 'lucide-react';
import type { Auxiliar, RestricaoAuxiliar } from '../types/supabase';
import {
  listarAuxiliaresParaLeitura,
} from '../services/neon/auxiliaresReadOnlyNeonService';
import {
  listarRestricoesParaLeitura,
  listarRestricoesPorAuxiliarEPeriodoParaLeitura,
} from '../services/neon/restricoesReadOnlyNeonService';

// Calcula datas para próximos 180 dias (executado fora do render)
const calcularDatasRestricoesProximos180Dias = (): [string, string] => {
  const agora = Date.now();
  const dataInicio = new Date(agora).toISOString().split('T')[0];
  const dataFim = new Date(agora + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return [dataInicio, dataFim];
};

interface EstadoP2 {
  vista: 'auxiliares' | 'restricoes' | 'detalhes-auxiliar';
  auxiliares: Auxiliar[];
  restricoes: RestricaoAuxiliar[];
  auxiliarSelecionado: Auxiliar | null;
  restricoesDauxiliar: RestricaoAuxiliar[];
  carregando: boolean;
  erro: string | null;
}

export function NeonP2CadastrosReadOnly() {
  const [estado, setEstado] = useState<EstadoP2>({
    vista: 'auxiliares',
    auxiliares: [],
    restricoes: [],
    auxiliarSelecionado: null,
    restricoesDauxiliar: [],
    carregando: false,
    erro: null,
  });

  // Carregar auxiliares ao montar
  useEffect(() => {
    const carregarAuxiliares = async () => {
      setEstado((prev) => ({ ...prev, carregando: true, erro: null }));
      const { data, error } = await listarAuxiliaresParaLeitura(false);
      if (error) {
        setEstado((prev) => ({ ...prev, carregando: false, erro: error }));
      } else {
        setEstado((prev) => ({ ...prev, auxiliares: data || [], carregando: false }));
      }
    };
    carregarAuxiliares();
  }, []);

  // Carregar restrições ao solicitar vista
  const abrirVista = async (vista: EstadoP2['vista']) => {
    if (vista === 'restricoes' && estado.restricoes.length === 0) {
      setEstado((prev) => ({ ...prev, carregando: true, erro: null }));
      const { data, error } = await listarRestricoesParaLeitura({ incluirInativas: false });
      if (error) {
        setEstado((prev) => ({ ...prev, carregando: false, erro: error }));
      } else {
        setEstado((prev) => ({ ...prev, restricoes: data || [], carregando: false, vista }));
      }
    } else {
      setEstado((prev) => ({ ...prev, vista }));
    }
  };

  // Ver detalhes de um auxiliar
  const verDetalhesAuxiliar = async (auxiliar: Auxiliar) => {
    setEstado((prev) => ({ ...prev, auxiliarSelecionado: auxiliar, carregando: true, erro: null }));

    // Carregar restrições específicas
    const [dataInicio, dataFim] = calcularDatasRestricoesProximos180Dias();

    const { data, error } = await listarRestricoesPorAuxiliarEPeriodoParaLeitura(
      auxiliar.id,
      dataInicio,
      dataFim
    );

    if (error) {
      setEstado((prev) => ({
        ...prev,
        carregando: false,
        erro: error,
        vista: 'detalhes-auxiliar',
      }));
    } else {
      setEstado((prev) => ({
        ...prev,
        restricoesDauxiliar: data || [],
        carregando: false,
        vista: 'detalhes-auxiliar',
      }));
    }
  };

  // =========================================================================
  // Vista: Auxiliares
  // =========================================================================

  if (estado.vista === 'auxiliares') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                  <Users size={32} className="text-blue-600" />
                  Auxiliares (P2 — Leitura)
                </h1>
                <p className="text-sm text-slate-600 mt-2">
                  Consulta de auxiliares do sistema. Mutações bloqueadas até aprovação de segurança.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirVista('restricoes')}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
                >
                  Ver Restrições
                </button>
              </div>
            </div>

            {/* Aviso P2 */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">P2 — Bloqueado por segurança</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Criação, atualização e desativação de auxiliares estão bloqueadas. Aguardando aprovação de
                  segurança específica para este domínio.
                </p>
              </div>
            </div>

            {/* Erro */}
            {estado.erro && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Erro</p>
                  <p className="text-sm text-red-700 mt-1">{estado.erro}</p>
                </div>
              </div>
            )}

            {/* Carregando */}
            {estado.carregando && (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-600 mt-3">Carregando...</p>
              </div>
            )}

            {/* Tabela de auxiliares */}
            {!estado.carregando && estado.auxiliares.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Nome</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Telefone</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Email</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-900">Status</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-900">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {estado.auxiliares.map((aux) => (
                      <tr key={aux.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-900 font-medium">{aux.nome}</td>
                        <td className="px-4 py-3 text-slate-600">{aux.telefone || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{aux.email || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {aux.ativa ? (
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              Ativa
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">
                              Inativa
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => verDetalhesAuxiliar(aux)}
                            className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition text-xs font-medium"
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!estado.carregando && estado.auxiliares.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p>Nenhuma auxiliar encontrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Vista: Restrições
  // =========================================================================

  if (estado.vista === 'restricoes') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                  <Lock size={32} className="text-orange-600" />
                  Restrições (P2 — Leitura)
                </h1>
                <p className="text-sm text-slate-600 mt-2">
                  Consulta de restrições de indisponibilidade. Mutações bloqueadas até aprovação de segurança.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirVista('auxiliares')}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
                >
                  Ver Auxiliares
                </button>
              </div>
            </div>

            {/* Aviso P2 */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">P2 — Bloqueado por segurança</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Criação, atualização e desativação de restrições estão bloqueadas. Aguardando aprovação de
                  segurança específica para este domínio.
                </p>
              </div>
            </div>

            {/* Erro */}
            {estado.erro && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Erro</p>
                  <p className="text-sm text-red-700 mt-1">{estado.erro}</p>
                </div>
              </div>
            )}

            {/* Carregando */}
            {estado.carregando && (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-600 mt-3">Carregando...</p>
              </div>
            )}

            {/* Tabela de restrições */}
            {!estado.carregando && estado.restricoes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Auxiliar</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Data</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Dia da Semana</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Porta</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Tipo</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-900">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {estado.restricoes.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-900 font-medium text-xs">{res.auxiliar_id.substring(0, 8)}</td>
                        <td className="px-4 py-3 text-slate-600">{res.data || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {res.dia_semana !== null ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][res.dia_semana] : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{res.porta || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                            {res.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{res.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!estado.carregando && estado.restricoes.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p>Nenhuma restrição encontrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Vista: Detalhes do Auxiliar
  // =========================================================================

  if (estado.vista === 'detalhes-auxiliar' && estado.auxiliarSelecionado) {
    const aux = estado.auxiliarSelecionado;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => abrirVista('auxiliares')}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                ← Voltar
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h2 className="text-2xl font-bold text-slate-900">{aux.nome}</h2>
              <p className="text-sm text-slate-600 mt-1">ID: {aux.id}</p>
              <div className="mt-3 flex gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    aux.ativa
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {aux.ativa ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>

            {/* Contato */}
            <section className="mb-6 p-4 border border-slate-200 rounded-lg">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <ChevronDown size={20} />
                Informações de Contato
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-600 font-medium">Telefone</p>
                  <p className="text-slate-900 font-medium">{aux.telefone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-medium">Email</p>
                  <p className="text-slate-900 font-medium">{aux.email || '—'}</p>
                </div>
              </div>
              {aux.observacoes && (
                <div className="mt-4">
                  <p className="text-xs text-slate-600 font-medium">Observações</p>
                  <p className="text-slate-900 mt-1">{aux.observacoes}</p>
                </div>
              )}
            </section>

            {/* Restrições */}
            <section className="mb-6 p-4 border border-slate-200 rounded-lg">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Lock size={20} />
                Restrições ({estado.restricoesDauxiliar.length})
              </h3>
              {estado.restricoesDauxiliar.length > 0 ? (
                <div className="space-y-2">
                  {estado.restricoesDauxiliar.map((res) => (
                    <div key={res.id} className="p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                      <div className="font-medium text-slate-900">
                        {res.data ? res.data : `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][res.dia_semana ?? 0]}`}
                        {res.porta && ` — Porta: ${res.porta}`}
                      </div>
                      <div className="text-xs text-slate-700 mt-1">
                        {res.tipo === 'indisponivel' && 'Indisponível'}
                        {res.motivo && ` — ${res.motivo}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 text-sm">Nenhuma restrição registrada</p>
              )}
            </section>

            {/* Aviso P2 */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">P2 — Edição bloqueada</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Alterações de cadastro estão bloqueadas. Aguardando aprovação de segurança.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
