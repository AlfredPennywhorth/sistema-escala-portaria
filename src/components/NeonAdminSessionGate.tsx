import { useEffect, useState, type ReactNode } from 'react';
import { criarClienteNeon } from '../lib/neon';
import { obterUsuarioAtual, obterPerfilUsuarioAtual } from '../services/neon/authService';

/** Unmount protected content on any session invalidation, discarding local data and pending views. */
export function NeonAdminSessionGate({ children }: { children: ReactNode }) {
  const [identidade, setIdentidade] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('Conferindo sessão Neon...');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    let geracao = 0;
    const invalidar = () => {
      geracao += 1;
      setIdentidade(null);
      setMensagem('Sessão alterada. Revalide o acesso administrativo Neon.');
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
    const cliente = criarClienteNeon();
    const { data: { subscription } } = cliente.auth.onAuthStateChange(invalidar);
    window.addEventListener('focus', invalidar);
    window.addEventListener('storage', invalidar);
    document.addEventListener('visibilitychange', invalidar);
    const timer = window.setTimeout(() => { void verificar(); }, 0);
    return () => {
      ativo = false;
      geracao += 1;
      window.clearTimeout(timer);
      subscription.unsubscribe();
      window.removeEventListener('focus', invalidar);
      window.removeEventListener('storage', invalidar);
      document.removeEventListener('visibilitychange', invalidar);
    };
  }, [tentativa]);

  if (!identidade) return (
    <main className="min-h-screen p-6">
      <p role="status">{mensagem}</p>
      <button type="button" className="m-2 rounded border p-2"
        onClick={() => setTentativa(n => n + 1)}>Revalidar sessão Neon</button>
      <a className="m-2 underline" href="?">Voltar à autenticação Neon</a>
    </main>
  );
  return <div key={identidade}>{children}</div>;
}
