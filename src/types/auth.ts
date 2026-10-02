import type { PerfilUsuarioAuxiliar } from './supabase';

export type PerfilUsuario = PerfilUsuarioAuxiliar;

export interface UsuarioPerfil {
  id: string;
  user_id: string;
  auxiliar_id: string | null;
  perfil: PerfilUsuario;
  created_at: string;
}

export interface AuthState {
  usuario: AuthUser | null;
  perfil: UsuarioPerfil | null;
  loading: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginInput {
  email: string;
  senha: string;
}

export interface MagicLinkInput {
  email: string;
  redirectTo?: string;
}

export type { ServiceResult } from './supabase';