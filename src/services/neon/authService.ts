import { criarClienteNeon } from '../../lib/neon';
import type { AuthUser, UsuarioPerfil, PerfilUsuario } from '../../types/auth';
import type { ServiceResult } from '../../types/auth';

function mapearUsuario(user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    email_confirmed_at: user.email_confirmed_at ?? null,
    created_at: user.created_at ?? '',
    updated_at: user.updated_at ?? '',
  };
}

/**
 * Autenticação de homologação Neon. Não é utilizada pelo runtime da aplicação.
 * A migração de contas e os fluxos de recuperação permanecem bloqueados
 * até teste de integração com Neon Auth e mapeamento dos usuários antigos.
 */
export async function obterUsuarioAtual(): Promise<ServiceResult<AuthUser | null>> {
  try {
    const { data, error } = await criarClienteNeon().auth.getUser();
    if (error) return { data: null, error: error.message };
    return { data: data.user ? mapearUsuario(data.user) : null, error: null };
  } catch {
    return { data: null, error: 'Erro ao consultar identidade no Neon' };
  }
}

export async function loginComEmailSenha(email: string, senha: string): Promise<ServiceResult<AuthUser>> {
  if (!email.trim() || !senha) return { data: null, error: 'Informe e-mail e senha' };
  try {
    const { data, error } = await criarClienteNeon().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) return { data: null, error: error.message };
    if (!data.user) return { data: null, error: 'Usuário não retornado pelo Neon Auth' };
    return { data: mapearUsuario(data.user), error: null };
  } catch {
    return { data: null, error: 'Erro ao autenticar no Neon' };
  }
}

export async function logout(): Promise<ServiceResult<null>> {
  try {
    const { error } = await criarClienteNeon().auth.signOut();
    return { data: null, error: error?.message ?? null };
  } catch {
    return { data: null, error: 'Falha ao encerrar sessão Neon' };
  }
}

export async function obterPerfilUsuarioAtual(): Promise<ServiceResult<UsuarioPerfil | null>> {
  try {
    const user = await obterUsuarioAtual();
    if (user.error) return { data: null, error: user.error };
    if (!user.data) return { data: null, error: null };
    const { data, error } = await criarClienteNeon()
      .from('usuarios_auxiliares')
      .select('*')
      .eq('user_id', user.data.id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as UsuarioPerfil | null, error: null };
  } catch {
    return { data: null, error: 'Erro ao consultar perfil Neon' };
  }
}

export async function verificarSeAdmin(): Promise<ServiceResult<boolean>> {
  const perfil = await obterPerfilUsuarioAtual();
  if (perfil.error) return { data: null, error: perfil.error };
  return { data: perfil.data?.perfil === 'admin', error: null };
}

export async function verificarSeAuxiliar(): Promise<ServiceResult<boolean>> {
  const perfil = await obterPerfilUsuarioAtual();
  if (perfil.error) return { data: null, error: perfil.error };
  return { data: perfil.data?.perfil === 'auxiliar', error: null };
}

export async function verificarSeCoordenadora(): Promise<ServiceResult<boolean>> {
  const perfil = await obterPerfilUsuarioAtual();
  if (perfil.error) return { data: null, error: perfil.error };
  return { data: perfil.data?.perfil === 'coordenadora', error: null };
}

export function obterPerfilTexto(perfil: PerfilUsuario | null | undefined): string {
  switch (perfil) {
    case 'admin': return 'Administrador';
    case 'coordenadora': return 'Coordenadora';
    case 'auxiliar': return 'Auxiliar';
    default: return 'Não definido';
  }
}

/**
 * PENDENTES: magic link (o SupabaseAuthAdapter usa OTP por e-mail),
 * cadastro administrativo, recuperação e atualização de senha.
 * Não simular sucesso nem acionar um fluxo diferente do exibido ao usuário.
 */
export async function enviarMagicLink(_email: string): Promise<ServiceResult<null>> {
  void _email;
  return { data: null, error: 'Magic link Neon ainda não homologado' };
}

export async function cadastrarComEmailSenha(_email: string, _senha: string): Promise<ServiceResult<AuthUser>> {
  void _email; void _senha;
  return { data: null, error: 'Cadastro desativado: usar provisionamento administrativo' };
}

export async function recuperarSenha(_email: string): Promise<ServiceResult<null>> {
  void _email;
  return { data: null, error: 'Recuperação de senha Neon ainda não homologada' };
}

export async function atualizarSenha(_novaSenha: string): Promise<ServiceResult<null>> {
  void _novaSenha;
  return { data: null, error: 'Troca de senha Neon ainda não homologada' };
}
