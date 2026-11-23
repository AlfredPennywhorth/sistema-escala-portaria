import { criarClienteNeon } from '../../lib/neon';

type DiagnosticoVinculo = {
  sessaoAutenticada: boolean;
  usuarioConfirmadoNoAuth: boolean;
  idsDaSessaoEAuthCoincidem: boolean;
  emailDaSessaoConfereComInformado: boolean | null;
  vinculoVisivelPelaRls: boolean;
  perfilVisivel: string | null;
  consultaSemErro: boolean;
  orientacao: string;
};

/**
 * Diagnóstico somente leitura, sem imprimir identificadores, e-mail, JWT ou OTP.
 * Em particular, uma consulta RLS que retorna zero linhas NÃO prova ausência
 * física do vínculo na base de dados.
 */
export async function diagnosticarVinculoNeonHml(emailEsperado: string): Promise<DiagnosticoVinculo> {
  const resultado: DiagnosticoVinculo = {
    sessaoAutenticada: false,
    usuarioConfirmadoNoAuth: false,
    idsDaSessaoEAuthCoincidem: false,
    emailDaSessaoConfereComInformado: null,
    vinculoVisivelPelaRls: false,
    perfilVisivel: null,
    consultaSemErro: false,
    orientacao: 'Diagnóstico não concluído.',
  };
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { ...resultado, orientacao: 'Diagnóstico disponível somente na homologação Neon.' };
  }
  try {
    const cliente = criarClienteNeon();
    const sessao = await cliente.auth.getSession();
    if (sessao.error || !sessao.data.session?.user) {
      return { ...resultado, orientacao: 'Nenhuma sessão Neon válida; autentique-se antes da consulta.' };
    }
    resultado.sessaoAutenticada = true;
    const usuario = await cliente.auth.getUser();
    if (usuario.error || !usuario.data.user) {
      return { ...resultado, orientacao: 'Sessão local presente, mas identidade não confirmada pelo Neon Auth.' };
    }
    resultado.usuarioConfirmadoNoAuth = true;
    resultado.idsDaSessaoEAuthCoincidem = sessao.data.session.user.id === usuario.data.user.id;
    const esperado = emailEsperado.trim().toLocaleLowerCase('en-US');
    if (esperado) {
      resultado.emailDaSessaoConfereComInformado =
        usuario.data.user.email?.trim().toLocaleLowerCase('en-US') === esperado;
    }
    if (!resultado.idsDaSessaoEAuthCoincidem || resultado.emailDaSessaoConfereComInformado === false) {
      return { ...resultado, orientacao: 'Identidade da sessão difere da identidade confirmada ou do e-mail informado; não consultar privilégios.' };
    }

    const perfil = await cliente.from('usuarios_auxiliares')
      .select('user_id,perfil')
      .eq('user_id', usuario.data.user.id)
      .maybeSingle();
    if (perfil.error) {
      return { ...resultado, orientacao: 'Consulta da RLS retornou erro. O diagnóstico não revela mensagens técnicas sensíveis.' };
    }
    resultado.consultaSemErro = true;
    resultado.vinculoVisivelPelaRls = Boolean(perfil.data);
    resultado.perfilVisivel = perfil.data?.perfil ?? null;
    resultado.orientacao = perfil.data
      ? 'Vínculo visível pela sessão JWT/RLS. O perfil mostrado é o cadastrado, não uma promoção automática.'
      : 'Nenhum vínculo visível pela RLS para a identidade confirmada; pode haver filtro por JWT/RLS ou divergência de ambiente. Não criar vínculo sem reconciliação.';
    return resultado;
  } catch {
    return { ...resultado, orientacao: 'Falha ao diagnosticar autenticação ou leitura. Nenhuma alteração foi executada.' };
  }
}
