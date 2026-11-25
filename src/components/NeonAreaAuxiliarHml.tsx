import { useCallback, useEffect, useRef, useState } from 'react';
import { criarClienteNeon } from '../lib/neon';
import { obterUsuarioAtual, obterPerfilUsuarioAtual, logout } from '../services/neon/authService';
import { obterMinhaAuxiliarNeon, listarMinhasDatasNeon } from '../services/neon/areaAuxiliarReadService';
import type { Auxiliar, RodizioItem } from '../types/supabase';

/**
 * Primeiro fluxo operacional da Auxiliar no Neon: suas datas, por JWT/RLS.
 * Somente leitura, exclusivo da homologação. Não reutiliza serviços Supabase.
 * Não exibe itens de outras auxiliares nem rascunhos.
 */
export function NeonAreaAuxiliarHml() {
  const [carregando, setCarregando] = useState(true);
  const [autorizada, setAutorizada] = useState(false);
  const [auxiliar, setAuxiliar] = useState<Auxiliar | null>(null);
  const [datas, setDatas] = useState<RodizioItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const geracao = useRef(0);
  const montado = useRef(false);

  const limpar = useCallback(() => {
    geracao.current += 1;
    setAutorizada(false);
    setAuxiliar(null);
    setDatas([]);
  }, []);

  const carregar = useCallback(async () => {
    limpar();
    const atual = geracao.current;
    const valido = () => montado.current && geracao.current === atual;
    setCarregando(true);
    setErro(null);
    try {
      const inicial = await obterUsuarioAtual();
      if (!valido()) return;
      if (inicial.error || !inicial.data) {
        setErro(inicial.error || 'Entre com sua conta Neon de homologação.');
        return;
      }
      const perfil = await obterPerfilUsuarioAtual();
      if (!valido()) return;
      if (perfil.error || perfil.data?.perfil !== 'auxiliar' || perfil.data.user_id !== inicial.data.id) {
        setErro(perfil.error || 'Área restrita à Auxiliar vinculada à sessão.');
        return;
      }
      const [minha, itens] = await Promise.all([obterMinhaAuxiliarNeon(), listarMinhasDatasNeon()]);
      if (!valido()) return;
      if (minha.error || itens.error || !minha.data || !itens.data) {
        setErro(minha.error || itens.error || 'Não foi possível consultar o vínculo pessoal e as datas.');
        return;
      }
      // Verificar a identidade e o perfil novamente antes de renderizar resultados
      // obtidos em chamadas HTTP independentes, inclusive após troca entre abas.
      const final = await obterUsuarioAtual();
      if (!valido()) return;
      if (final.error || final.data?.id !== inicial.data.id) {
        setErro('Sessão alterada durante a leitura. Atualize e autentique-se novamente.');
        return;
      }
      const perfilFinal = await obterPerfilUsuarioAtual();
      if (!valido()) return;
      if (perfilFinal.error || perfilFinal.data?.perfil !== 'auxiliar' ||
          perfilFinal.data.user_id !== inicial.data.id ||
          perfilFinal.data.auxiliar_id !== minha.data.id) {
        setErro('Vínculo pessoal alterado. Nenhuma data foi exibida.');
        return;
      }
      if (itens.data.some(item => item.auxiliar_id !== minha.data!.id)) {
        setErro('Leitura recusada: um item não pertence à auxiliar autenticada.');
        return;
      }
      setAuxiliar(minha.data);
      setDatas(itens.data);
      setAutorizada(true);
    } catch {
      if (valido()) setErro('Falha ao consultar datas Neon. Nenhuma informação foi exibida.');
    } finally {
      if (valido()) setCarregando(false);
    }
  }, [limpar]);

  useEffect(() => {
    montado.current = true;
    const cliente = criarClienteNeon();
    const { data: { subscription } } = cliente.auth.onAuthStateChange(() => {
      limpar();
      setCarregando(false);
      setErro('Sessão alterada. Atualize as consultas para revalidar.');
    });
    const invalidar = () => {
      limpar();
      setCarregando(false);
      setErro('Revalide sua sessão para consultar novamente suas datas.');
    };
    window.addEventListener('focus', invalidar);
    window.addEventListener('storage', invalidar);
    document.addEventListener('visibilitychange', invalidar);
    const inicio = window.setTimeout(() => { void carregar(); }, 0);
    return () => {
      window.clearTimeout(inicio);
      montado.current = false;
      limpar();
      subscription.unsubscribe();
      window.removeEventListener('focus', invalidar);
      window.removeEventListener('storage', invalidar);
      document.removeEventListener('visibilitychange', invalidar);
    };
  }, [carregar, limpar]);

  async function sair() {
    limpar();
    setCarregando(false);
    const resultado = await logout();
    if (montado.current) {
      setErro(resultado.error
        ? 'O provedor não confirmou o logout: ' + resultado.error + '. Não considerar a sessão encerrada.'
        : 'Logout solicitado. Confirme a ausência de sessão antes de compartilhar o aparelho.');
    }
  }

  const botao = 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50';
  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <section className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold">Minhas datas — Neon HML</h1>
          <p className="mt-2 text-sm text-slate-600">
            Prévia somente leitura da Auxiliar. Nenhuma escala será alterada.
            A aplicação de produção continua no Supabase.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={botao} disabled={carregando} onClick={() => void carregar()}>
              Atualizar minhas datas
            </button>
            <a className={botao} href="?">Voltar à homologação</a>
            <button type="button" className={botao} disabled={carregando} onClick={() => void sair()}>
              Encerrar sessão
            </button>
          </div>
        </header>
        {carregando && <p role="status" className="rounded-lg bg-white p-4">Validando identidade e consultando minhas datas...</p>}
        {erro && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">{erro}</p>}
        {!carregando && autorizada && auxiliar && !erro && (
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Datas vinculadas a {auxiliar.nome}</h2>
            <p className="mt-1 text-sm text-slate-600">{datas.length} item(ns) visível(is) em escalas publicadas ou travadas.</p>
            {datas.length === 100 && <p role="status" className="mt-2 text-sm text-amber-900">
              Limite de 100 registros atingido: listagem pode estar incompleta. Não utilizar como relatório integral.
            </p>}
            {datas.length === 0 ? <p className="mt-4 text-sm">Nenhuma data disponível nesta sessão.</p> : (
              <ul className="mt-4 divide-y divide-slate-200">
                {datas.map(item => (
                  <li key={item.id} className="py-3 text-sm">
                    <span className="font-medium">{item.data} · {item.porta}</span>
                    <span className="block text-slate-600">{item.periodo || 'Período não informado'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
