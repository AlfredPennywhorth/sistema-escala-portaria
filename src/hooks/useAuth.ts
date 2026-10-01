import { useState, useEffect, useCallback } from 'react';
import type { AuthUser, UsuarioPerfil } from '../types/auth';
import * as authService from '../services/authService';
import { supabase } from '../lib/supabase';

interface UseAuthReturn {
  usuario: AuthUser | null;
  perfil: UsuarioPerfil | null;
  loading: boolean;
  isAdmin: boolean;
  isAuxiliar: boolean;
  isCoordenadora: boolean;
  login: (email: string, senha: string) => Promise<{ error: string | null }>;
  logout: () => Promise<{ error: string | null }>;
  enviarMagicLink: (email: string) => Promise<{ error: string | null }>;
  recarregar: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [usuario, setUsuario] = useState<AuthUser | null>(null);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuxiliar, setIsAuxiliar] = useState(false);
  const [isCoordenadora, setIsCoordenadora] = useState(false);

  const atualizarEstados = useCallback((user: AuthUser | null, perfilData: UsuarioPerfil | null) => {
    setUsuario(user);
    setPerfil(perfilData);
    setIsAdmin(user !== null && perfilData?.perfil === 'admin');
    setIsAuxiliar(user !== null && perfilData?.perfil === 'auxiliar');
    setIsCoordenadora(user !== null && perfilData?.perfil === 'coordenadora');
    setLoading(false);
  }, []);

  const carregarSessao = useCallback(async () => {
    try {
      const [sessaoResult, perfilResult] = await Promise.all([
        authService.obterUsuarioAtual(),
        authService.obterPerfilUsuarioAtual(),
      ]);

      if (sessaoResult.error || perfilResult.error) {
        atualizarEstados(null, null);
      } else {
        atualizarEstados(sessaoResult.data, perfilResult.data);
      }
    } catch {
      atualizarEstados(null, null);
    }
  }, [atualizarEstados]);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 10000);
    
    const init = async () => {
      await carregarSessao();
    };
    
    init();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      clearTimeout(timeout);
      if (mounted) {
        carregarSessao();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [carregarSessao]);

  const login = useCallback(async (email: string, senha: string) => {
    const result = await authService.loginComEmailSenha(email, senha);
    if (!result.error && result.data) {
      await carregarSessao();
    }
    return { error: result.error };
  }, [carregarSessao]);

  const logout = useCallback(async () => {
    const result = await authService.logout();
    if (!result.error) {
      atualizarEstados(null, null);
    }
    return { error: result.error };
  }, [atualizarEstados]);

  const enviarMagicLink = useCallback(async (email: string) => {
    const result = await authService.enviarMagicLink(email);
    return { error: result.error };
  }, []);

  return {
    usuario,
    perfil,
    loading,
    isAdmin,
    isAuxiliar,
    isCoordenadora,
    login,
    logout,
    enviarMagicLink,
    recarregar: carregarSessao,
  };
}