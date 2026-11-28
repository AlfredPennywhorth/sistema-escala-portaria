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


/**
 * Inspeção SOMENTE de leitura para a homologação do perfil auxiliar.
 * Todos os resultados vêm da Data API usando a sessão do navegador e RLS.
 * Um resultado vazio não equivale a uma prova de que um HTTP 403 ocorreu.
 */
export async function verificarPermissoesAuxiliarNeon() {
  const cliente = criarClienteNeon();
  const sessao = await cliente.auth.getSession();
  if (sessao.error) return { erro: sessao.error.message, dados: null };
  if (!sessao.data.session?.user) return { erro: 'Sessão autenticada obrigatória', dados: null };

  const perfil = await cliente.from('usuarios_auxiliares')
    .select('perfil,auxiliar_id')
    .eq('user_id', sessao.data.session.user.id)
    .maybeSingle();
  if (perfil.error) return { erro: perfil.error.message, dados: null };

  // Reaproveitar EXATAMENTE a mesma consulta do teste de escalas já validado
  // no celular. Executar os SELECTs sequencialmente para isolar possíveis
  // diferenças de autenticação/requisição ao investigar divergências.
  const rodizios = await verificarLeituraEscalasNeon();
  if (rodizios.erro) return { erro: rodizios.erro, dados: null };
  const auxiliares = await cliente.from('auxiliares').select('id').limit(20);
  if (auxiliares.error) return { erro: auxiliares.error.message, dados: null };
  const restricoes = await cliente.from('restricoes_auxiliares').select('id').limit(20);
  if (restricoes.error) return { erro: restricoes.error.message, dados: null };

  const escalas: Array<{ status: string }> = rodizios.dados ?? [];
  const publicadas = escalas.filter((v) => v.status === 'publicado' || v.status === 'travado').length;
  const rascunhos = escalas.filter((v) => v.status === 'rascunho').length;
  const auxiliaresVisiveis: Array<{ id: string }> = auxiliares.data ?? [];
  const propriaAuxiliar = Boolean(perfil.data?.auxiliar_id
    && auxiliaresVisiveis.some((v) => v.id === perfil.data?.auxiliar_id));
  return {
    erro: null,
    dados: {
      perfil: perfil.data?.perfil ?? 'Sem vínculo',
      escalasConsultadas: escalas.length,
      statusEscalasVisiveis: escalas.map((v) => v.status),
      escalasPublicadasOuTravadas: publicadas,
      rascunhosVisiveis: rascunhos,
      auxiliaresVisiveis: auxiliaresVisiveis.length,
      propriaAuxiliarVisivel: propriaAuxiliar,
      restricoesVisiveis: (restricoes.data ?? []).length,
    },
  };
}
