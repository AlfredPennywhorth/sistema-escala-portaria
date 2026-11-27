import { useEffect, useState, type ReactNode } from 'react';
import { criarClienteNeon } from '../lib/neon';
import { obterUsuarioAtual, obterPerfilUsuarioAtual } from '../services/neon/authService';

/** Never expose protected content until identity and administrative profile are verified. */
export function NeonAdminSessionGate({ children }: { children: ReactNode }) {
  const [identidade, setIdentidade] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('Conferindo sessão Neon...');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    let geracao = 0;
    let timer: ReturnType<typeof window.setTimeout> | undefined;
    let subscription: { unsubscribe(): void } | undefined;
    const invalidar = (texto: string) => {
      geracao += 1;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      setIdentidade(null);
      setMensagem(texto);
    };
    const verificar = async () => {
      const atual = ++geracao;
      try {
        const inicio = await obterUsuarioAtual();
        if (!ativo || atual !== geracao) return;
        if (inicio.error || !inicio.data) {
          setMensagem('Autentique-se no Neon antes de acessar esta área.');
          return;
        }
        const perfil = await obterPerfilUsuarioAtual();
        const fim = await obterUsuarioAtual();
        if (!ativo || atual !== geracao) return;
        if (perfil.error || fim.error || perfil.data?.perfil !== 'admin' ||
            perfil.data.user_id !== inicio.data.id || fim.data?.id !== inicio.data.id) {
          setMensagem('Acesso administrativo Neon não confirmado.');
          return;
        }
        setIdentidade(inicio.data.id);
      } catch {
        if (ativo && atual === geracao) setMensagem('Não foi possível verificar a sessão Neon.');
      }
    };
    const agendar = () => {
      if (!ativo) return;
      invalidar('Conferindo sessão Neon...');
      timer = window.setTimeout(() => { timer = undefined; void verificar(); }, 150);
    };
    const revalidarVisibilidade = () => {
      if (document.visibilityState === 'visible') agendar();
      else invalidar('Sessão em segundo plano. Revalide ao retornar.');
    };
    try {
      const cliente = criarClienteNeon();
      subscription = cliente.auth.onAuthStateChange((evento: unknown) => {
        // INITIAL_SESSION is the subscription's initial notification, not a
        // change of identity. The independent getUser/profile checks below
        // establish the initial authorization.
        if (!ativo || String(evento) === 'INITIAL_SESSION') return;
        if (String(evento) === 'SIGNED_OUT') {
          invalidar('Sessão encerrada. Autentique-se novamente no Neon.');
          return;
        }
        agendar();
      }).data.subscription;
      window.addEventListener('focus', agendar);
      window.addEventListener('storage', agendar);
      document.addEventListener('visibilitychange', revalidarVisibilidade);
      // Schedule outside the effect body; subsequent events coalesce rather
      // than leaving the gate permanently in an invalidated state.
      timer = window.setTimeout(() => { timer = undefined; void verificar(); }, 150);
    } catch {
      timer = window.setTimeout(() => {
        if (ativo) invalidar('Não foi possível iniciar a validação Neon.');
      }, 0);
    }
    return () => {
      ativo = false;
      geracao += 1;
      if (timer !== undefined) window.clearTimeout(timer);
      subscription?.unsubscribe();
      window.removeEventListener('focus', agendar);
      window.removeEventListener('storage', agendar);
      document.removeEventListener('visibilitychange', revalidarVisibilidade);
    };
  }, [tentativa]);

  if (!identidade) return (
    <main className="min-h-screen p-6">
      <p role="status">{mensagem}</p>
      <button type="button" className="m-2 rounded border p-2"
        onClick={() => { setMensagem('Conferindo sessão Neon...'); setTentativa(n => n + 1); }}>Revalidar sessão Neon</button>
      <a className="m-2 underline" href="?">Voltar à autenticação Neon</a>
    </main>
  );
  return <div key={identidade}>{children}</div>;
}
