import { useCallback, useEffect, useState } from 'react';
import { obterPerfilUsuarioAtual, obterUsuarioAtual, logout } from '../services/neon/authService';
import { listarRodiziosAdministrativosNeonHml, obterRodizioComItensNeonHml } from '../services/neon/rodizioFunctionalHmlService';
import { listarAuxiliares } from '../services/neon/auxiliaresService';
import { listarRestricoesAtivas } from '../services/neon/restricoesService';
import type { Auxiliar, RestricaoAuxiliar, Rodizio, RodizioComItens } from '../types/supabase';

/**
 * Primeiro corte da integração operacional: consultas Neon por JWT e RLS.
 * NÃO há gravação, geração persistida, publicação, travamento ou exclusão.
 * App.tsx monta esta tela somente no host de homologação e com opt-in explícito.
 */
export function NeonOperacionalHml() {
  const [carregando, setCarregando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rodizios, setRodizios] = useState<Rodizio[]>([]);
  const [auxiliares, setAuxiliares] = useState<Auxiliar[]>([]);
  const [restricoes, setRestricoes] = useState<RestricaoAuxiliar[]>([]);
  const [detalhe, setDetalhe] = useState<RodizioComItens | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setAutorizado(false);
    setDetalhe(null);
    setRodizios([]);
    setAuxiliares([]);
    setRestricoes([]);
    try {
      const identidade = await obterUsuarioAtual();
      if (identidade.error || !identidade.data) {
        setErro(identidade.error || 'Entre com uma conta de homologação Neon antes de consultar as escalas.');
        return;
      }
      const vinculo = await obterPerfilUsuarioAtual();
      if (vinculo.error || vinculo.data?.perfil !== 'admin') {
        setErro(vinculo.error || 'Esta prévia administrativa exige vínculo Admin validado no Neon.');
        return;
      }
      setAutorizado(true);
      const [escalas, listaAuxiliares, listaRestricoes] = await Promise.all([
        listarRodiziosAdministrativosNeonHml(),
        listarAuxiliares(true),
        listarRestricoesAtivas(),
      ]);
      if (escalas.error || listaAuxiliares.error || listaRestricoes.error ||
          !escalas.data || !listaAuxiliares.data || !listaRestricoes.data) {
        setErro([escalas.error, listaAuxiliares.error, listaRestricoes.error]
          .filter(Boolean).join(' | ') || 'Falha em consulta Neon; nenhum dado parcial foi exibido.');
        return;
      }
      setRodizios(escalas.data);
      setAuxiliares(listaAuxiliares.data);
      setRestricoes(listaRestricoes.data);
    } catch {
      setErro('Falha na leitura operacional Neon. Confira a sessão e o ambiente.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function abrirRodizio(id: string) {
    setAbrindo(true);
    setErro(null);
    setDetalhe(null);
    try {
      const result = await obterRodizioComItensNeonHml(id);
      if (result.error || !result.data) {
        setErro(result.error || 'Escala indisponível. Consulte novamente.');
        return;
      }
      setDetalhe(result.data);
    } finally {
      setAbrindo(false);
    }
  }

  async function sair() {
    setErro(null);
    const resultado = await logout();
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    setAutorizado(false);
    setRodizios([]);
    setAuxiliares([]);
    setRestricoes([]);
    setDetalhe(null);
  }

  const btn = 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50';
  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <section className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Prévia operacional Neon — somente leitura</h1>
          <p className="mt-2 text-sm text-slate-700">
            Ambiente isolado de homologação. O app Supabase de produção não foi alterado.
            Nenhuma ação nesta tela cria, edita, publica ou trava escalas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btn} type="button" disabled={carregando || abrindo} onClick={() => void carregar()}>
              Atualizar consultas
            </button>
            <a className={btn} href="?">Voltar à homologação de autenticação</a>
            <button className={btn} type="button" disabled={carregando || abrindo} onClick={() => void sair()}>
              Encerrar sessão Neon
            </button>
          </div>
        </header>
        {carregando && <p role="status" className="rounded-lg bg-white p-4 text-slate-700">Conferindo sessão, perfil e permissões Neon...</p>}
        {erro && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">{erro}</p>}
        {!carregando && !autorizado && (
          <p className="rounded-lg bg-white p-4 text-slate-700">
            Sem acesso administrativo. Autentique-se na tela de homologação e confirme o vínculo no Neon.
          </p>
        )}
        {!carregando && autorizado && !erro && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">Escalas visíveis</p><p className="text-2xl font-semibold">{rodizios.length}</p></div>
              <div className="rounded-lg bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">Auxiliares visíveis</p><p className="text-2xl font-semibold">{auxiliares.length}</p></div>
              <div className="rounded-lg bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">Restrições ativas visíveis</p><p className="text-2xl font-semibold">{restricoes.length}</p></div>
            </div>
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Escalas</h2>
              <p className="mb-3 text-sm text-slate-600">Listagem autorizada por JWT, perfil e RLS. Os dados na HML podem ser fictícios.</p>
              {rodizios.length === 0 ? <p className="text-sm">Nenhuma escala visível.</p> : (
                <ul className="divide-y divide-slate-200">
                  {rodizios.map(rodizio => (
                    <li key={rodizio.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{rodizio.titulo}</p>
                        <p className="text-sm text-slate-600">{rodizio.data_inicio} a {rodizio.data_fim} · {rodizio.status}{rodizio.travado ? ' · travado' : ''}</p>
                      </div>
                      <button type="button" className={btn} disabled={abrindo} onClick={() => void abrirRodizio(rodizio.id)}>
                        Consultar itens
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {detalhe && (
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold">{detalhe.rodizio.titulo}</h2>
                <p className="mb-3 text-sm text-slate-600">
                  Revisão {String((detalhe.rodizio as Rodizio & { revisao?: number | string }).revisao ?? 'não informada')} · {detalhe.itens.length} itens
                </p>
                <ul className="divide-y divide-slate-100">
                  {detalhe.itens.map(item => (
                    <li key={item.id} className="py-2 text-sm text-slate-800">
                      {item.data} · {item.porta} · {item.periodo || 'Sem período'}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
