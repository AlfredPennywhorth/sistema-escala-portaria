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
  const [modo, setModo] = useState<'senha' | 'magiclink' | 'cadastro' | 'recuperacao' | 'atualizar'>('senha');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const { login, enviarMagicLink, cadastrar, recuperarSenha, atualizarSenha } = useAuth();

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

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    try {
      const result = await cadastrar(email, senha);

      if (result.error) {
        setErro(result.error);
      } else {
        setSucesso('Conta criada com sucesso! Verifique seu email se necessário ou faça login.');
        setModo('senha');
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleRecuperacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    try {
      const result = await recuperarSenha(email);

      if (result.error) {
        setErro(result.error);
      } else {
        setSucesso('Instruções de recuperação enviadas para seu email!');
        setTimeout(() => setModo('senha'), 3000);
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleAtualizarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    try {
      const result = await atualizarSenha(senha);

      if (result.error) {
        setErro(result.error);
      } else {
        setSucesso('Senha atualizada com sucesso!');
        setTimeout(() => {
          setModo('senha');
          if (onClose) onClose();
        }, 2000);
      }
    } finally {
      setCarregando(false);
    }
  };

  // Se a URL tiver access_token e type=recovery, o supabase auth vai logar o usuário
  // e podemos mostrar a tela de atualizar senha se quisermos. O ideal seria detectar
  // esse estado, mas por simplicidade deixaremos a opção manual ou guiada.

  return (
    <div className={clsx(compact ? "bg-white rounded-xl p-4 shadow-lg" : "min-h-screen flex items-center justify-center bg-gray-100 p-4")}>
      <div className={clsx("w-full max-w-md", compact && "")}>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">
              {modo === 'senha' || modo === 'magiclink' ? 'Entrar no Sistema' : 
               modo === 'cadastro' ? 'Criar Conta' : 
               modo === 'atualizar' ? 'Nova Senha' : 'Recuperar Senha'}
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

          <div className="flex flex-wrap mb-4 border-b border-gray-200">
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
              Login
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
              Link Email
            </button>
            <button
              type="button"
              onClick={() => { setModo('cadastro'); setErro(null); setSucesso(null); }}
              className={clsx(
                'flex-1 py-2 text-center text-sm font-medium transition-colors',
                modo === 'cadastro'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Cadastrar
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

          <form onSubmit={
            modo === 'senha' ? handleLogin : 
            modo === 'magiclink' ? handleMagicLink : 
            modo === 'cadastro' ? handleCadastro : 
            modo === 'atualizar' ? handleAtualizarSenha : handleRecuperacao
          }>
            {modo !== 'atualizar' && (
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
            )}

            {(modo === 'senha' || modo === 'cadastro' || modo === 'atualizar') && (
              <div className="mb-6">
                <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
                  {modo === 'atualizar' ? 'Nova Senha' : 'Senha'}
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
                    placeholder={modo === 'atualizar' ? "Sua nova senha" : "Sua senha"}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
            
            {modo === 'senha' && (
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={() => { setModo('recuperacao'); setErro(null); setSucesso(null); }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Esqueci minha senha
                </button>
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
              ) : modo === 'cadastro' ? (
                <>
                  <Lock className="h-5 w-5" />
                  Cadastrar
                </>
              ) : modo === 'recuperacao' ? (
                <>
                  <Send className="h-5 w-5" />
                  Recuperar Senha
                </>
              ) : modo === 'atualizar' ? (
                <>
                  <Lock className="h-5 w-5" />
                  Atualizar Senha
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
            {modo === 'senha' && 'Ainda não tem conta? '}
            {modo === 'senha' && (
              <button type="button" onClick={() => setModo('cadastro')} className="ml-1 text-blue-600 hover:text-blue-800 font-medium">
                Cadastre-se
              </button>
            )}
            
            {(modo === 'recuperacao' || modo === 'cadastro' || modo === 'atualizar') && 'Já tem uma conta? '}
            {(modo === 'recuperacao' || modo === 'cadastro' || modo === 'atualizar') && (
              <button type="button" onClick={() => setModo('senha')} className="ml-1 text-blue-600 hover:text-blue-800 font-medium">
                Faça login
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}