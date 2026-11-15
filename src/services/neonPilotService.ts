import { criarClienteNeon } from '../lib/neon';

/**
 * Piloto isolado para verificar a autenticação e a proteção RLS no destino.
 * A migração dos serviços existentes é bloqueada até estes testes passarem.
 */
export async function verificarNeonPilot() {
  const cliente = criarClienteNeon();
  const sessao = await cliente.auth.getSession();
  if (sessao.error) {
    return { conectado: false, usuario: null, erro: sessao.error.message };
  }

  if (!sessao.data.session?.user) {
    return { conectado: false, usuario: null, erro: 'Sessão autenticada obrigatória' };
  }

  const perfil = await cliente
    .from('usuarios_auxiliares')
    .select('id, user_id, auxiliar_id, perfil')
    .eq('user_id', sessao.data.session.user.id)
    .maybeSingle();

  if (perfil.error) {
    return { conectado: false, usuario: sessao.data.session.user.id, erro: perfil.error.message };
  }
  return {
    conectado: true,
    usuario: sessao.data.session.user.id,
    perfil: perfil.data,
    erro: null,
  };
}

export async function verificarLeituraEscalasNeon() {
  const cliente = criarClienteNeon();
  const resultado = await cliente
    .from('rodizios')
    .select('id, titulo, status, travado')
    .order('data_inicio', { ascending: false })
    .limit(20);

  return {
    dados: resultado.data,
    erro: resultado.error?.message ?? null,
  };
}
