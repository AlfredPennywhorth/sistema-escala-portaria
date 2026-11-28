import { useCallback, useEffect, useRef, useState } from 'react';
import { obterPerfilUsuarioAtual, obterUsuarioAtual, logout } from '../services/neon/authService';
import { criarClienteNeon } from '../lib/neon';
import { NeonRascunhoPreparacaoHml } from './NeonRascunhoPreparacaoHml';
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
  const [filtroAuxiliar, setFiltroAuxiliar] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [detalhe, setDetalhe] = useState<RodizioComItens | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  // Qualquer alteração de sessão invalida imediatamente o conteúdo anterior.
  // A geração também impede respostas atrasadas de repovoar a tela.
  const geracao = useRef(0);
  const montado = useRef(false);
  const identidadeAtiva = useRef<string | null>(null);

  const limparDados = useCallback(() => {
    geracao.current += 1;
    identidadeAtiva.current = null;
    setAutorizado(false);
    setRodizios([]);
    setAuxiliares([]);
    setRestricoes([]);
    setDetalhe(null);
    setAbrindo(false);
  }, []);

  const carregar = useCallback(async () => {
    limparDados();
    const atual = geracao.current;
    const valido = () => montado.current && geracao.current === atual;
    setCarregando(true);
    setErro(null);
    try {
      const identidade = await obterUsuarioAtual();
      if (!valido()) return;
      if (identidade.error || !identidade.data) {
        setErro(identidade.error || 'Entre com uma conta de homologação Neon antes de consultar as escalas.');
        return;
      }
      const id = identidade.data.id;
      const vinculo = await obterPerfilUsuarioAtual();
      if (!valido()) return;
      if (vinculo.error || vinculo.data?.perfil !== 'admin') {
        setErro(vinculo.error || 'Esta prévia administrativa exige vínculo Admin validado no Neon.');
        return;
      }
      const [escalas, listaAuxiliares, listaRestricoes] = await Promise.all([
        listarRodiziosAdministrativosNeonHml(),
        listarAuxiliares(true),
        listarRestricoesAtivas(),
      ]);
      if (!valido()) return;
      if (escalas.error || listaAuxiliares.error || listaRestricoes.error ||
          !escalas.data || !listaAuxiliares.data || !listaRestricoes.data) {
        setErro([escalas.error, listaAuxiliares.error, listaRestricoes.error]
          .filter(Boolean).join(' | ') || 'Falha em consulta Neon; nenhum dado parcial foi exibido.');
        return;
      }

      // A sessão pode mudar enquanto o servidor executa consultas.
      const confirmacao = await obterUsuarioAtual();
      if (!valido()) return;
      if (confirmacao.error || confirmacao.data?.id !== id) {
        limparDados();
        setCarregando(false);
        setErro('Sessão Neon alterada durante a consulta. Entre novamente e atualize.');
        return;
      }
      const perfilFinal = await obterPerfilUsuarioAtual();
      if (!valido()) return;
      if (perfilFinal.error || perfilFinal.data?.perfil !== 'admin') {
        limparDados();
        setCarregando(false);
        setErro('Perfil Neon alterado durante a consulta. Dados administrativos ocultados.');
        return;
      }
      identidadeAtiva.current = id;
      setRodizios(escalas.data);
      setAuxiliares(listaAuxiliares.data);
      setRestricoes(listaRestricoes.data);
      setAutorizado(true);
    } catch {
      if (valido()) setErro('Falha na leitura operacional Neon. Confira a sessão e o ambiente.');
    } finally {
      if (valido()) setCarregando(false);
    }
  }, [limparDados]);

  useEffect(() => {
    montado.current = true;
    const cliente = criarClienteNeon();
    const { data: { subscription } } = cliente.auth.onAuthStateChange(() => {
      // Inclui logout/login em outra aba quando propagados pelo SDK.
      limparDados();
      setCarregando(false);
      setErro('Sessão Neon modificada. Atualize as consultas para revalidar o perfil.');
    });
    const revalidarAoRetornar = () => {
      // Eventos de foco/visibilidade/storage complementam a propagação
      // entre abas; não reutilizar dados administrativos sem revalidar.
      limparDados();
      setCarregando(false);
      setErro('Revalide sua sessão Neon para exibir novamente os dados.');
    };
    window.addEventListener('focus', revalidarAoRetornar);
    window.addEventListener('storage', revalidarAoRetornar);
    document.addEventListener('visibilitychange', revalidarAoRetornar);
    // Iniciar após o setup do efeito, sem setState síncrono no corpo dele.
    const inicio = window.setTimeout(() => { void carregar(); }, 0);
    return () => {
      window.clearTimeout(inicio);
      montado.current = false;
      limparDados();
      subscription.unsubscribe();
      window.removeEventListener('focus', revalidarAoRetornar);
      window.removeEventListener('storage', revalidarAoRetornar);
      document.removeEventListener('visibilitychange', revalidarAoRetornar);
    };
  }, [carregar, limparDados]);

  async function abrirRodizio(id: string) {
    if (!autorizado || !identidadeAtiva.current || carregando || abrindo) return;
    const atual = geracao.current;
    const idInicial = identidadeAtiva.current;
    const valido = () => montado.current && geracao.current === atual &&
      identidadeAtiva.current === idInicial;
    setAbrindo(true);
    setErro(null);
    setDetalhe(null);
    try {
      const result = await obterRodizioComItensNeonHml(id, 'consulta-hml');
      if (!valido()) return;
      if (result.error || !result.data) {
        setErro(result.error || 'Escala indisponível. Consulte novamente.');
        return;
      }
      const confirmacao = await obterUsuarioAtual();
      if (!valido()) return;
      if (confirmacao.error || confirmacao.data?.id !== idInicial) {
        limparDados();
        setErro('A sessão mudou enquanto os itens eram consultados.');
        return;
      }
      const perfil = await obterPerfilUsuarioAtual();
      if (!valido()) return;
      if (perfil.error || perfil.data?.perfil !== 'admin') {
        limparDados();
        setErro('Permissão administrativa alterada. Os itens foram ocultados.');
        return;
      }
      setDetalhe(result.data);
    } catch {
      if (valido()) setErro('Falha ao consultar itens Neon.');
    } finally {
      if (valido()) setAbrindo(false);
    }
  }

  async function sair() {
    limparDados(); // nunca manter conteúdo enquanto logout está pendente
    setCarregando(false);
    setErro(null);
    const resultado = await logout();
    if (resultado.error && montado.current) {
      setErro('Não foi possível encerrar a sessão. Dados ocultados; confira o acesso: ' + resultado.error);
    }
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
            <section className="rounded-xl bg-white p-4 shadow-sm" aria-label="Consulta de auxiliares e restrições">
              <h2 className="text-lg font-semibold text-slate-900">Auxiliares e restrições — consulta</h2>
              <p className="mt-1 text-sm text-slate-600">
                Cadastro somente leitura, sujeito à sessão Admin e à RLS do Neon.
                Alterações e exclusões permanecem desabilitadas.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label htmlFor="busca-auxiliar-neon" className="text-sm font-medium text-slate-700">
                  Buscar auxiliar
                </label>
                <input
                  id="busca-auxiliar-neon"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={filtroAuxiliar}
                  onChange={e => setFiltroAuxiliar(e.target.value)}
                  placeholder="Nome da auxiliar"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={mostrarInativas}
                    onChange={e => setMostrarInativas(e.target.checked)}
                  />
                  Incluir inativas
                </label>
              </div>
              <ul className="mt-3 divide-y divide-slate-200">
                {auxiliares
                  .filter(auxiliar => (mostrarInativas || auxiliar.ativa) &&
                    auxiliar.nome.toLocaleLowerCase('pt-BR').includes(filtroAuxiliar.trim().toLocaleLowerCase('pt-BR')))
                  .map(auxiliar => {
                    const regras = restricoes.filter(item => item.auxiliar_id === auxiliar.id);
                    return (
                      <li key={auxiliar.id} className="py-3">
                        <p className="font-medium text-slate-900">
                          {auxiliar.nome}{!auxiliar.ativa ? ' (inativa)' : ''}
                        </p>
                        <p className="text-sm text-slate-600">
                          {regras.length} restrição(ões) ativa(s) visível(is)
                        </p>
                        {regras.length > 0 && (
                          <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                            {regras.map(regra => (
                              <li key={regra.id}>
                                {regra.tipo} · {regra.data || (regra.dia_semana != null
                                  ? 'Dia da semana ' + regra.dia_semana : 'Recorrência não informada')}
                                {regra.porta ? ' · ' + regra.porta : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
              {auxiliares.filter(auxiliar => (mostrarInativas || auxiliar.ativa) &&
                auxiliar.nome.toLocaleLowerCase('pt-BR').includes(filtroAuxiliar.trim().toLocaleLowerCase('pt-BR'))).length === 0 && (
                <p className="py-3 text-sm text-slate-600">Nenhuma auxiliar corresponde ao filtro.</p>
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
            {detalhe && detalhe.rodizio.status === 'rascunho' && !detalhe.rodizio.travado && (
              <NeonRascunhoPreparacaoHml
                key={detalhe.rodizio.id + ':' + String((detalhe.rodizio as Rodizio & { revisao?: number | string }).revisao ?? '')}
                detalhe={detalhe}
                auxiliares={auxiliares}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
