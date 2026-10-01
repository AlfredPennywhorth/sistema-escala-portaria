import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, LogOut, Shield, UserCircle, Heart, LogIn, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { LoginSupabase } from './LoginSupabase';

interface AuthStatusProps {
  compact?: boolean;
}

export function AuthStatus({ compact = false }: AuthStatusProps) {
  const { usuario, isAdmin, isAuxiliar, isCoordenadora, loading, logout } = useAuth();
  const [mostrarLogin, setMostrarLogin] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-sm text-gray-500",
        compact ? "px-2 py-1" : "px-3 py-1.5 bg-gray-50 rounded-lg"
      )}>
        <User className="h-4 w-4 animate-pulse" />
        {!compact && <span>Carregando...</span>}
      </div>
    );
  }

  if (!usuario) {
    return (
      <>
        <button
          onClick={() => setMostrarLogin(true)}
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-all",
            compact 
              ? "px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" 
              : "px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm"
          )}
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </button>
        
        {mostrarLogin && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md relative">
              <button
                onClick={() => setMostrarLogin(false)}
                className="absolute -top-8 right-0 p-2 text-white hover:text-gray-200"
              >
                ✕ Fechar
              </button>
              <LoginSupabase onClose={() => setMostrarLogin(false)} />
            </div>
          </div>
        )}
      </>
    );
  }

  const perfilTexto = () => {
    if (isAdmin) return 'Administrador';
    if (isCoordenadora) return 'Coordenadora';
    if (isAuxiliar) return 'Auxiliar';
    return 'Sem perfil';
  };

  const perfilIcone = () => {
    if (isAdmin) return <Shield className="h-4 w-4" />;
    if (isCoordenadora) return <Heart className="h-4 w-4" />;
    return <UserCircle className="h-4 w-4" />;
  };

  const perfilBadgeClass = cn(
    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
    isAdmin && 'bg-purple-100 text-purple-700',
    isCoordenadora && 'bg-pink-100 text-pink-700',
    isAuxiliar && 'bg-blue-100 text-blue-700',
    !isAdmin && !isCoordenadora && !isAuxiliar && 'bg-red-100 text-red-700'
  );

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 max-w-full",
      compact ? "" : "px-3 py-2 bg-gray-50 rounded-lg"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <User className="h-4 w-4 text-gray-600 shrink-0" />
        <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]" title={usuario.email}>
          {usuario.email}
        </span>
      </div>

      <div className={cn(perfilBadgeClass, "shrink-0")}>
        {perfilIcone()}
        {perfilTexto()}
      </div>

      {!isAdmin && !isCoordenadora && (
        <div title="Você não tem perfil de administrador. Algumas funções podem estar bloqueadas.">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Sair"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}