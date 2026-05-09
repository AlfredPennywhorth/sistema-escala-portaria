import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Send, Loader2, X } from 'lucide-react';
import clsx from 'clsx';

interface LoginSupabaseProps {
  onClose?: () => void;
  compact?: boolean;
}

export function LoginSupabase({ onClose, compact = false }: LoginSupabaseProps) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState<'senha' | 'magiclink'>('senha');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const { login, enviarMagicLink } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    try {
      const result = await login(email, senha);

      if (result.error) {
        setErro(result.error);
      } else if (onClose) {
        onClose();
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    try {
      const result = await enviarMagicLink(email);

      if (result.error) {
        setErro(result.error);
      } else {
        setSucesso('Link de acesso enviado para seu email!');
        setEmail('');
        if (onClose) {
          setTimeout(onClose, 2000);
        }
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className={clsx(compact ? "bg-white rounded-xl p-4 shadow-lg" : "min-h-screen flex items-center justify-center bg-gray-100 p-4")}>
      <div className={clsx("w-full max-w-md", compact && "")}>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">
              Entrar no Sistema
            </h1>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex mb-4 border-b border-gray-200">
            <button
              type="button"
              onClick={() => { setModo('senha'); setErro(null); setSucesso(null); }}
              className={clsx(
                'flex-1 py-2 text-center text-sm font-medium transition-colors',
                modo === 'senha'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Login com Senha
            </button>
            <button
              type="button"
              onClick={() => { setModo('magiclink'); setErro(null); setSucesso(null); }}
              className={clsx(
                'flex-1 py-2 text-center text-sm font-medium transition-colors',
                modo === 'magiclink'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Link por Email
            </button>
          </div>

          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {sucesso && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">{sucesso}</p>
            </div>
          )}

          <form onSubmit={modo === 'senha' ? handleLogin : handleMagicLink}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {modo === 'senha' && (
              <div className="mb-6">
                <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-white font-medium transition-colors',
                carregando
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {carregando ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : modo === 'senha' ? (
                <>
                  <Lock className="h-5 w-5" />
                  Entrar
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Enviar Link
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-gray-500">
            {modo === 'senha'
              ? 'Prefere receber um link por email?'
              : 'Prefere fazer login com senha?'}
            <button
              type="button"
              onClick={() => setModo(modo === 'senha' ? 'magiclink' : 'senha')}
              className="ml-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              Clique aqui
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}