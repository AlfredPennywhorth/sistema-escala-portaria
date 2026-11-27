/**
 * Componente de relatório e impressão para rodízios Neon — P3
 *
 * Reutiliza o padrão visual do EscalaView e os dados do Neon.
 * Suporta impressão em PDF.
 *
 * Restrições:
 * - Sem fallback Supabase
 * - Dados somente-leitura do Neon
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Printer, X } from 'lucide-react';
import type { RodizioComItens } from '../types/supabase';
import { obterRodizioComItensNeonHml } from '../services/neon/rodizioFunctionalHmlService';
import logoCCB from '/logo-ccb.png';
import { listarAuxiliares } from '../services/neon/auxiliaresService';
import { format, parseISO } from 'date-fns';

interface NeonRelatorioRodizioProps {
  rodizioId: string;
  onFechar: () => void;
}

export function NeonRelatorioRodizio({ rodizioId, onFechar }: NeonRelatorioRodizioProps) {
  const [rodizio, setRodizio] = useState<RodizioComItens | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Carregar dados do Neon
  useEffect(() => {
    let ativo = true;
    const carregarDados = async () => {
      setCarregando(true);
      setErro(null);
      setRodizio(null);
      try {
        const [escala, cadastro] = await Promise.all([obterRodizioComItensNeonHml(rodizioId, 'consulta-hml'), listarAuxiliares(true)]);
        if (!ativo) return;
        if (escala.error || !escala.data || cadastro.error || !cadastro.data || cadastro.data.length >= 1000) {
          setErro(escala.error || cadastro.error || 'Dados do relatório incompletos.');
          return;
        }
        const mapa = Object.fromEntries(cadastro.data.map(a => [a.id, a.nome]));
        if (escala.data.itens.some(i => i.auxiliar_id && !mapa[i.auxiliar_id])) {
          setErro('Uma ou mais auxiliares não foram localizadas. Não é seguro emitir o relatório incompleto.');
          return;
        }
        setNomes(mapa);
        setRodizio(escala.data);
      } catch {
        if (ativo) setErro('Falha ao carregar relatório.');
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    void carregarDados();
    return () => { ativo = false; };
  }, [rodizioId]);

  const handleImprimir = () => {
    window.print();
  };

  if (carregando) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Erro ao carregar</h3>
              <p className="text-sm text-red-700 mt-1">{erro}</p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!rodizio) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 text-center">
          <p className="text-slate-600">Nenhum relatório disponível</p>
          <button
            onClick={onFechar}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const r = rodizio.rodizio;
  const items = rodizio.itens || [];

  // =========================================================================
  // Renderização do relatório
  // =========================================================================

  return (
    <>
      {/* Modal de controle (oculto na impressão) */}
      <div className="no-print fixed top-4 right-4 z-40 flex gap-2">
        <button
          onClick={handleImprimir}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition shadow-lg"
        >
          <Printer size={18} />
          Imprimir
        </button>
        <button
          onClick={onFechar}
          className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2 transition shadow-lg"
        >
          <X size={18} />
          Fechar
        </button>
      </div>

      {/* Conteúdo do relatório */}
      <div className="bg-white min-h-screen p-8 print:p-4">
        {/* Cabeçalho */}
        <header className="mb-8 pb-6 border-b-2 border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <img src={logoCCB} alt="CCB" className="h-12 w-auto object-contain mb-2" />
              <h1 className="text-3xl print:text-2xl font-black text-blue-900">
                RELATÓRIO DE ESCALA
              </h1>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>Emitido: {new Date().toLocaleDateString('pt-BR')}</p>
              <p>Hora: {new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
          </div>
        </header>

        {/* Informações da escala */}
        <section className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-xl print:text-lg font-bold text-slate-900 mb-4">Informações da Escala</h2>
          <div className="grid grid-cols-2 gap-6 print:gap-4">
            <div>
              <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Título</p>
              <p className="text-lg print:text-sm font-semibold text-slate-900">{r.titulo}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Status</p>
              <p className="text-lg print:text-sm font-semibold">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    r.status === 'publicado'
                      ? 'bg-green-100 text-green-800'
                      : r.status === 'travado'
                      ? 'bg-yellow-100 text-yellow-800'
                      : r.status === 'cancelado'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {r.status?.toUpperCase() || 'RASCUNHO'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Período</p>
              <p className="text-sm text-slate-900">
                {format(parseISO(r.data_inicio), 'dd/MM/yyyy')} a{' '}
                {format(parseISO(r.data_fim), 'dd/MM/yyyy')}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Total de Itens</p>
              <p className="text-sm text-slate-900 font-semibold">{items.length} itens</p>
            </div>
          </div>
          {r.observacoes && (
            <div className="mt-4">
              <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Observações</p>
              <p className="text-sm text-slate-900">{r.observacoes}</p>
            </div>
          )}
        </section>

        {/* Tabela de itens */}
        <section className="mb-8">
          <h2 className="text-xl print:text-lg font-bold text-slate-900 mb-4">Itens da Escala</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm print:text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white print:bg-slate-800">
                  <th className="border border-slate-300 px-4 py-3 text-left font-semibold">Data</th>
                  <th className="border border-slate-300 px-4 py-3 text-left font-semibold">Porta</th>
                  <th className="border border-slate-300 px-4 py-3 text-left font-semibold">Auxiliar</th>
                  <th className="border border-slate-300 px-4 py-3 text-center font-semibold">Período</th>
                  <th className="border border-slate-300 px-4 py-3 text-left font-semibold">Observações</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="border border-slate-300 px-4 py-2">
                        {format(parseISO(item.data), 'dd/MM/yyyy')}
                      </td>
                      <td className="border border-slate-300 px-4 py-2 font-semibold">{item.porta}</td>
                      <td className="border border-slate-300 px-4 py-2">
                        {item.auxiliar_id ? nomes[item.auxiliar_id] : '—'}
                      </td>
                      <td className="border border-slate-300 px-4 py-2 text-center">
                        {item.periodo ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-4 py-2 text-xs">
                        {item.observacoes ?? '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="border border-slate-300 px-4 py-6 text-center text-slate-500">
                      Nenhum item na escala
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rodapé */}
        <footer className="mt-12 pt-6 border-t-2 border-slate-200 text-xs text-slate-600">
          <p>Este relatório foi gerado pelo Sistema de Escala Neon em homologação.</p>
          <p className="mt-2">Fonte: Neon — Read-Only Portal</p>
        </footer>
      </div>
    </>
  );
}
