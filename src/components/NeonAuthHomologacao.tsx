import { useState } from 'react';
import { loginComEmailSenha, logout } from '../services/neon/authService';
import { verificarNeonPilot, verificarLeituraEscalasNeon } from '../services/neonPilotService';

/**
 * Tela apenas para ambiente isolado com VITE_NEON_HOMOLOGACAO_ENABLED=true.
 * Não ativar sem domínio de teste autorizado pelo Neon Auth.
 */
export function NeonAuthHomologacao() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [resumo, setResumo] = useState<string | null>(null);

  async function executar(operacao: () => Promise<void>) {
    setOcupado(true);
    setMensagem('');
    try {
      await operacao();
    } catch {
      setMensagem('Falha de conexão. Verifique as URLs de homologação.');
    } finally {
      setOcupado(false);
    }
  }

  async function conferirSessao() {
    const resultado = await verificarNeonPilot();
    if (resultado.erro) {
      setResumo(null);
      setMensagem(resultado.erro);
      return;
    }
    setResumo(JSON.stringify({
      autenticado: resultado.conectado,
      usuario: resultado.usuario ? 'Identidade verificada' : 'Sem identidade',
      perfil: resultado.perfil?.perfil ?? 'Sem vínculo',
    }, null, 2));
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <section className="mx-auto max-w-md rounded-xl bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Homologação Neon Auth</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ambiente de testes isolado. Não utilize senhas de produção enquanto as contas não forem migradas.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void executar(async () => {
              const retorno = await loginComEmailSenha(email, senha);
              setSenha('');
              if (retorno.error) {
                setResumo(null);
                setMensagem(retorno.error);
                return;
              }
              setMensagem('Login aceito pelo provedor. Confira o vínculo e as permissões.');
              await conferirSessao();
            });
          }}
        >
          <label className="block text-sm font-medium text-slate-700" htmlFor="neon-email">E-mail de teste</label>
          <input
            id="neon-email"
            className="w-full rounded-md border border-slate-300 p-3"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="block text-sm font-medium text-slate-700" htmlFor="neon-senha">Senha de teste</label>
          <input
            id="neon-senha"
            className="w-full rounded-md border border-slate-300 p-3"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button className="w-full rounded-md bg-blue-700 px-4 py-3 text-white disabled:opacity-50" type="submit" disabled={ocupado}>
            Entrar com Neon Auth
          </button>
        </form>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(conferirSessao)}
          >Verificar sessão e perfil</button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarLeituraEscalasNeon();
              setResumo(null);
              setMensagem(retorno.erro || `Consulta permitida: ${retorno.dados?.length ?? 0} escala(s)`);
            })}
          >Testar acesso às escalas</button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await logout();
              setResumo(null);
              setSenha('');
              setMensagem(retorno.error || 'Logout solicitado. Verifique novamente a sessão.');
            })}
          >Encerrar sessão</button>
        </div>
        {mensagem && <p role="status" className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{mensagem}</p>}
        {resumo && <pre className="mt-3 overflow-auto rounded-md bg-slate-100 p-3 text-xs text-slate-700">{resumo}</pre>}
        <p className="mt-5 text-xs text-slate-500">Esta tela não comprova sozinha a homologação: registre testes de acesso permitido e negado por perfil.</p>
      </section>
    </main>
  );
}
