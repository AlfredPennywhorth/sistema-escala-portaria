import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, Loader2, AlertCircle, Check, Shield } from 'lucide-react';
import clsx from 'clsx';
import { LoginSupabase } from './LoginSupabase';

export function LoginPage() {
  const { usuario, isAdmin, isAuxiliar, isCoordenadora, loading, logout } = useAuth();
  const [mostrarFormLogin, setMostrarFormLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  if (usuario) {
    const perfilTexto = () => {
      if (isAdmin) return 'Administrador';
      if (isCoordenadora) return 'Coordenadora';
      if (isAuxiliar) return 'Auxiliar';
      return 'Sem perfil';
    };

    const perfilCor = () => {
      if (isAdmin) return 'bg-purple-500';
      if (isCoordenadora) return 'bg-pink-500';
      if (isAuxiliar) return 'bg-blue-500';
      return 'bg-gray-500';
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Sessão Ativa</h1>
              <p className="text-slate-500 mt-2">{usuario.email}</p>
            </div>

            <div className={clsx(
              "rounded-2xl p-4 text-center text-white mb-6",
              perfilCor()
            )}>
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" />
                <span className="font-bold text-lg">{perfilTexto()}</span>
              </div>
            </div>

            {!isAdmin && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Sem permissão de administrador</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Você está logado, mas não possui perfil admin. 
                      Algumas funcionalidades estão bloqueadas.
                    </p>
                    <p className="text-xs text-amber-600 mt-2 font-mono">
                      INSERT INTO usuarios_auxiliares (user_id, perfil) 
                      VALUES ('{usuario.id}', 'admin');
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <p className="text-green-700 text-center font-medium">
                  ✅ Você tem acesso completo ao sistema
                </p>
              </div>
            )}

            <button
              onClick={logout}
              className="w-full py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mostrarFormLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <button
              onClick={() => setMostrarFormLogin(false)}
              className="text-slate-500 hover:text-slate-700 mb-4"
            >
              ← Voltar
            </button>
            <LoginSupabase />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Sistema de Escala</h1>
          <p className="text-blue-100 mt-2">Faça login para acessar</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Entrar</h2>
            <p className="text-slate-500 text-sm mt-1">
              Use suas credenciais do Supabase
            </p>
          </div>

          <button
            onClick={() => setMostrarFormLogin(true)}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
          >
            <Lock className="w-5 h-5" />
            Fazer Login
          </button>

          <div className="mt-6 text-center text-sm text-slate-500">
            <p>Não tem login?</p>
            <p className="mt-1">Solicite ao administrador do sistema.</p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-blue-200 text-sm">
            Credenciais: Supabase Auth
          </p>
        </div>
      </div>
    </div>
  );
}