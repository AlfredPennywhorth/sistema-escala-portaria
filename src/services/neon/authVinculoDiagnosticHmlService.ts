import { criarClienteNeon } from '../../lib/neon';

export type EstadoRpcJwtPostgres =
  | 'nao_executado'
  | 'erro_rpc'
  | 'sql_null'
  | 'formato_inesperado'
  | 'identidade_valida';

export type FormatoRespostaRpcJwt =
  | 'nao_executado'
  | 'erro'
  | 'null'
  | 'undefined'
  | 'string'
  | 'string_vazia'
  | 'objeto_usuario_atual_id'
  | 'array_objeto_usuario_atual_id'
  | 'array_string'
  | 'array_vazio'
  | 'array_multiplo'
  | 'objeto_inesperado'
  | 'outro_tipo';

export type DiagnosticoVinculo = {
  sessaoAutenticada: boolean;
  usuarioConfirmadoNoAuth: boolean;
  idsDaSessaoEAuthCoincidem: boolean;
  emailDaSessaoConfereComInformado: boolean | null;
  vinculoVisivelPelaRls: boolean;
  perfilVisivel: string | null;
  consultaSemErro: boolean;
  jwtPostgresDisponivel: boolean | null;
  jwtPostgresCoincideComAuth: boolean | null;
  jwtRpcEstado: EstadoRpcJwtPostgres;
  jwtRpcFormato: FormatoRespostaRpcJwt;
  orientacao: string;
};

type RespostaRpcIdentidade = {
  data: unknown;
  error: unknown;
};

type RespostaVinculoRls = {
  data: { user_id: string; perfil: string | null } | null;
  error: unknown;
};

export type ClienteDiagnosticoNeonHml = {
  auth: {
    onAuthStateChange: (callback: (evento: string) => void) => {
      data: { subscription: { unsubscribe: () => void } };
    };
    getSession: () => Promise<{
      data: { session: { user: { id: string }; access_token: string } | null };
      error: unknown;
    }>;
    getUser: () => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown;
    }>;
  };
  rpc: (fn: string) => PromiseLike<RespostaRpcIdentidade>;
  from: (tabela: string) => {
    select: (colunas: string) => {
      eq: (coluna: string, valor: string) => {
        maybeSingle: () => PromiseLike<RespostaVinculoRls>;
      };
    };
  };
};

type OpcoesDiagnosticoVinculoNeonHml = {
  cliente?: ClienteDiagnosticoNeonHml;
  env?: { VITE_NEON_HOMOLOGACAO_ENABLED?: string };
};

type AnaliseRpcIdentidade = {
  estado: EstadoRpcJwtPostgres;
  formato: FormatoRespostaRpcJwt;
  identidadeSql: string | null;
  jwtPostgresDisponivel: boolean | null;
};

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function analisarObjetoUsuarioAtualId(
  obj: Record<string, unknown>,
  formatoSucesso: 'objeto_usuario_atual_id' | 'array_objeto_usuario_atual_id',
): AnaliseRpcIdentidade {
  const chaves = Object.keys(obj);
  if (chaves.length !== 1 || chaves[0] !== 'usuario_atual_id') {
    return {
      estado: 'formato_inesperado',
      formato: 'objeto_inesperado',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  const valor = obj.usuario_atual_id;
  if (valor === null) {
    return {
      estado: 'sql_null',
      formato: formatoSucesso,
      identidadeSql: null,
      jwtPostgresDisponivel: false,
    };
  }
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    if (!limpo) {
      return {
        estado: 'formato_inesperado',
        formato: 'string_vazia',
        identidadeSql: null,
        jwtPostgresDisponivel: null,
      };
    }
    return {
      estado: 'identidade_valida',
      formato: formatoSucesso,
      identidadeSql: limpo,
      jwtPostgresDisponivel: true,
    };
  }
  return {
    estado: 'formato_inesperado',
    formato: 'objeto_inesperado',
    identidadeSql: null,
    jwtPostgresDisponivel: null,
  };
}

/**
 * Classifica o retorno da RPC usuario_atual_id() sem expor UUID ou payload.
 * Distingue explicitamente erro de RPC, retorno SQL NULL, formato inesperado
 * e identidade textual reconhecida (escalar ou encapsulada por PostgREST).
 */
function analisarRespostaRpcIdentidade(jwtSql: RespostaRpcIdentidade): AnaliseRpcIdentidade {
  if (jwtSql.error) {
    return {
      estado: 'erro_rpc',
      formato: 'erro',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  const dados = jwtSql.data;
  if (dados === null) {
    return {
      estado: 'sql_null',
      formato: 'null',
      identidadeSql: null,
      jwtPostgresDisponivel: false,
    };
  }
  if (dados === undefined) {
    return {
      estado: 'formato_inesperado',
      formato: 'undefined',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  if (typeof dados === 'string') {
    const limpo = dados.trim();
    if (!limpo) {
      return {
        estado: 'formato_inesperado',
        formato: 'string_vazia',
        identidadeSql: null,
        jwtPostgresDisponivel: null,
      };
    }
    return {
      estado: 'identidade_valida',
      formato: 'string',
      identidadeSql: limpo,
      jwtPostgresDisponivel: true,
    };
  }
  if (Array.isArray(dados)) {
    if (dados.length === 0) {
      return {
        estado: 'formato_inesperado',
        formato: 'array_vazio',
        identidadeSql: null,
        jwtPostgresDisponivel: null,
      };
    }
    if (dados.length > 1) {
      return {
        estado: 'formato_inesperado',
        formato: 'array_multiplo',
        identidadeSql: null,
        jwtPostgresDisponivel: null,
      };
    }
    const unico = dados[0];
    if (typeof unico === 'string') {
      const limpo = unico.trim();
      if (!limpo) {
        return {
          estado: 'formato_inesperado',
          formato: 'string_vazia',
          identidadeSql: null,
          jwtPostgresDisponivel: null,
        };
      }
      return {
        estado: 'identidade_valida',
        formato: 'array_string',
        identidadeSql: limpo,
        jwtPostgresDisponivel: true,
      };
    }
    if (ehObjetoSimples(unico)) {
      return analisarObjetoUsuarioAtualId(unico, 'array_objeto_usuario_atual_id');
    }
    return {
      estado: 'formato_inesperado',
      formato: 'outro_tipo',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  if (ehObjetoSimples(dados)) {
    return analisarObjetoUsuarioAtualId(dados, 'objeto_usuario_atual_id');
  }
  return {
    estado: 'formato_inesperado',
    formato: 'outro_tipo',
    identidadeSql: null,
    jwtPostgresDisponivel: null,
  };
}

/**
 * Diagnóstico somente leitura, sem imprimir identificadores, e-mail, JWT ou OTP.
 * Em particular, uma consulta RLS que retorna zero linhas NÃO prova ausência
 * física do vínculo na base de dados, e uma resposta em formato inesperado da
 * RPC não deve ser confundida com ausência do JWT no PostgreSQL.
 */
export async function diagnosticarVinculoNeonHml(
  emailEsperado: string,
  opcoes?: OpcoesDiagnosticoVinculoNeonHml,
): Promise<DiagnosticoVinculo> {
  const resultado: DiagnosticoVinculo = {
    sessaoAutenticada: false,
    usuarioConfirmadoNoAuth: false,
    idsDaSessaoEAuthCoincidem: false,
    emailDaSessaoConfereComInformado: null,
    vinculoVisivelPelaRls: false,
    perfilVisivel: null,
    consultaSemErro: false,
    jwtPostgresDisponivel: null,
    jwtPostgresCoincideComAuth: null,
    jwtRpcEstado: 'nao_executado',
    jwtRpcFormato: 'nao_executado',
    orientacao: 'Diagnóstico não concluído.',
  };
  const envAtual = opcoes?.env ?? import.meta.env;
  if (envAtual?.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { ...resultado, orientacao: 'Diagnóstico disponível somente na homologação Neon.' };
  }
  const cliente: ClienteDiagnosticoNeonHml = opcoes?.cliente ?? (criarClienteNeon() as unknown as ClienteDiagnosticoNeonHml);
  // Se qualquer evento de autenticação ocorrer no intervalo, nenhum resultado
  // sobre privilégios é confiável, mesmo que A -> B -> A termine no mesmo ID.
  let alterouSessao = false;
  const { data: { subscription } } = cliente.auth.onAuthStateChange((evento: string) => {
    if (evento !== 'INITIAL_SESSION') alterouSessao = true;
  });
  const invalido = () => ({
    ...resultado,
    vinculoVisivelPelaRls: false,
    perfilVisivel: null,
    consultaSemErro: false,
    jwtPostgresDisponivel: null,
    jwtPostgresCoincideComAuth: null,
    jwtRpcEstado: 'nao_executado' as const,
    jwtRpcFormato: 'nao_executado' as const,
    orientacao: 'Sessão Neon alterada durante o diagnóstico. Resultado descartado; revalide a sessão antes de consultar vínculos.',
  });
  try {
    const sessao = await cliente.auth.getSession();
    if (sessao.error || !sessao.data.session?.user) {
      return { ...resultado, orientacao: 'Nenhuma sessão Neon válida; autentique-se antes da consulta.' };
    }
    if (alterouSessao) return invalido();
    const idInicial = sessao.data.session.user.id;
    const tokenInicial = sessao.data.session.access_token;
    resultado.sessaoAutenticada = true;
    const usuario = await cliente.auth.getUser();
    if (usuario.error || !usuario.data.user) {
      return { ...resultado, orientacao: 'Sessão local presente, mas identidade não confirmada pelo Neon Auth.' };
    }
    if (alterouSessao) return invalido();
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

    // Função SQL STABLE já existente: SELECT auth.uid(). Nenhum UUID é
    // retornado à interface. A análise separa erro de RPC, SQL NULL,
    // formato inesperado da resposta e identidade válida.
    const jwtSql = await cliente.rpc('usuario_atual_id');
    if (alterouSessao) return invalido();
    const analiseRpc = analisarRespostaRpcIdentidade(jwtSql);
    const identidadeSql = analiseRpc.identidadeSql;
    const jwtPostgresDisponivel = analiseRpc.jwtPostgresDisponivel;
    const jwtPostgresCoincideComAuth = jwtSql.error || !identidadeSql
      ? null : identidadeSql === idInicial;

    const perfil = await cliente.from('usuarios_auxiliares')
      .select('user_id,perfil')
      .eq('user_id', usuario.data.user.id)
      .maybeSingle();
    // Comparar novamente a sessão e o Auth APÓS a consulta protegida por RLS.
    // A geração por evento detecta ainda mudanças rápidas de A -> B -> A.
    if (alterouSessao) return invalido();
    const sessaoFinal = await cliente.auth.getSession();
    if (alterouSessao || sessaoFinal.error ||
        sessaoFinal.data.session?.user.id !== idInicial ||
        sessaoFinal.data.session?.access_token !== tokenInicial) return invalido();
    const usuarioFinal = await cliente.auth.getUser();
    if (alterouSessao || usuarioFinal.error ||
        usuarioFinal.data.user?.id !== idInicial ||
        usuarioFinal.data.user?.email?.trim().toLocaleLowerCase('en-US') !==
          usuario.data.user.email?.trim().toLocaleLowerCase('en-US')) return invalido();
    // Somente após reconfirmar a sessão, conservar os indicadores da RPC,
    // inclusive quando a consulta RLS falha (sem divulgar o erro técnico).
    resultado.jwtPostgresDisponivel = jwtPostgresDisponivel;
    resultado.jwtPostgresCoincideComAuth = jwtPostgresCoincideComAuth;
    resultado.jwtRpcEstado = analiseRpc.estado;
    resultado.jwtRpcFormato = analiseRpc.formato;
    if (perfil.error) {
      return { ...resultado, orientacao: 'Consulta da RLS retornou erro. O diagnóstico não revela mensagens técnicas sensíveis.' };
    }
    if (perfil.data && perfil.data.user_id !== idInicial) return invalido();
    resultado.consultaSemErro = true;
    resultado.vinculoVisivelPelaRls = Boolean(perfil.data);
    resultado.perfilVisivel = perfil.data?.perfil ?? null;
    resultado.orientacao = jwtSql.error
      ? 'RPC de identidade PostgreSQL indisponível. Não é possível concluir se o JWT chegou ao SQL; verificar configuração de exposição e grants.'
      : analiseRpc.estado === 'formato_inesperado'
        ? perfil.data
          ? 'Formato inesperado na resposta da RPC usuario_atual_id(); vínculo visível pela RLS, mas identidade SQL não pôde ser confirmada. Verificar serialização do SDK/Data API.'
          : 'Formato inesperado na resposta da RPC usuario_atual_id(); não é possível confirmar a identidade SQL.'
        : jwtPostgresDisponivel === false
          ? perfil.data
            ? 'Divergência detectada: vínculo visível pela RLS, mas a RPC usuario_atual_id() retornou NULL no PostgreSQL. Investigar contexto de execução da RPC na Data API e políticas RLS.'
            : 'Identidade JWT ausente no contexto PostgreSQL; investigar transmissão do token à Data API.'
          : jwtPostgresCoincideComAuth === false
            ? 'Identidade do JWT PostgreSQL difere da sessão Neon Auth; investigar origem do token.'
            : perfil.data
              ? 'Vínculo visível pela sessão JWT/RLS. O perfil mostrado é o cadastrado, não uma promoção automática.'
              : 'Identidade SQL verificada; nenhum vínculo visível pela RLS. Investigar branch de destino e políticas sem criar cadastro.';
    return alterouSessao ? invalido() : resultado;
  } catch {
    return { ...resultado, vinculoVisivelPelaRls: false, perfilVisivel: null,
      consultaSemErro: false,
      jwtPostgresDisponivel: null,
      jwtPostgresCoincideComAuth: null,
      jwtRpcEstado: 'nao_executado',
      jwtRpcFormato: 'nao_executado',
      orientacao: 'Falha ao diagnosticar autenticação ou leitura. Nenhuma alteração foi executada.' };
  } finally {
    subscription.unsubscribe();
  }
}
