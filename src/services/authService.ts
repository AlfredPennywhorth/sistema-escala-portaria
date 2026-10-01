import { supabase } from '../lib/supabase';
import type { AuthUser, UsuarioPerfil, PerfilUsuario } from '../types/auth';
import type { ServiceResult } from '../types/auth';

export async function obterSessaoAtual(): Promise<ServiceResult<import('@supabase/supabase-js').Session | null>> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data.session, error: null };
  } catch {
    return { data: null, error: 'Erro ao obter sessão' };
  }
}

export async function obterUsuarioAtual(): Promise<ServiceResult<AuthUser | null>> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data.user) {
      return { data: null, error: null };
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? '',
      email_confirmed_at: data.user.email_confirmed_at ?? null,
      created_at: data.user.created_at ?? new Date().toISOString(),
      updated_at: data.user.updated_at ?? new Date().toISOString(),
    };

    return { data: authUser, error: null };
  } catch {
    return { data: null, error: 'Erro ao obter usuário' };
  }
}

export async function loginComEmailSenha(email: string, senha: string): Promise<ServiceResult<AuthUser>> {
  if (!email || email.trim() === '') {
    return { data: null, error: 'Email é obrigatório' };
  }

  if (!senha || senha.length < 6) {
    return { data: null, error: 'Senha deve ter pelo menos 6 caracteres' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data.user) {
      return { data: null, error: 'Falha ao fazer login' };
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? '',
      email_confirmed_at: data.user.email_confirmed_at ?? null,
      created_at: data.user.created_at ?? new Date().toISOString(),
      updated_at: data.user.updated_at ?? new Date().toISOString(),
    };

    return { data: authUser, error: null };
  } catch {
    return { data: null, error: 'Erro ao fazer login' };
  }
}

export async function logout(): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: 'Erro ao fazer logout' };
  }
}

export async function enviarMagicLink(email: string, redirectTo?: string): Promise<ServiceResult<null>> {
  if (!email || email.trim() === '') {
    return { data: null, error: 'Email é obrigatório' };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo || window.location.origin,
      },
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: 'Erro ao enviar magic link' };
  }
}

export async function obterPerfilUsuarioAtual(): Promise<ServiceResult<UsuarioPerfil | null>> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      return { data: null, error: sessionError.message };
    }

    if (!sessionData.session?.user) {
      return { data: null, error: null };
    }

    const userId = sessionData.session.user.id;

    const { data, error } = await supabase
      .from('usuarios_auxiliares')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as UsuarioPerfil | null, error: null };
  } catch {
    return { data: null, error: 'Erro ao obter perfil do usuário' };
  }
}

export async function verificarSeAdmin(): Promise<ServiceResult<boolean>> {
  const result = await obterPerfilUsuarioAtual();

  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: result.data?.perfil === 'admin', error: null };
}

export async function verificarSeAuxiliar(): Promise<ServiceResult<boolean>> {
  const result = await obterPerfilUsuarioAtual();

  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: result.data?.perfil === 'auxiliar', error: null };
}

export async function verificarSeCoordenadora(): Promise<ServiceResult<boolean>> {
  const result = await obterPerfilUsuarioAtual();

  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: result.data?.perfil === 'coordenadora', error: null };
}

export function obterPerfilTexto(perfil: PerfilUsuario | null | undefined): string {
  switch (perfil) {
    case 'admin':
      return 'Administrador';
    case 'coordenadora':
      return 'Coordenadora';
    case 'auxiliar':
      return 'Auxiliar';
    default:
      return 'Não definido';
  }
}