import { criarClienteNeon } from '../../lib/neon';

export type EstadoRpcJwtPostgres =
  | 'nao_executado'
  | 'identidade_valida'
  | 'sql_null'
  | 'corpo_vazio_200'
  | 'sem_conteudo_204'
  | 'nao_autorizado_401'
  | 'proibido_403'
  | 'erro_rede'
  | 'timeout'
  | 'erro_rpc'
  | 'formato_inesperado';

export type FormatoRespostaRpcJwt =
  | 'nao_executado'
  | 'erro'
  | 'null'
  | 'corpo_vazio'
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

export type MetodoRpcJwt = 'POST' | 'GET';

export type ResumoSondaRpcJwt = {
  metodo: MetodoRpcJwt;
  httpStatus: number | null;
  corpoVazio: boolean | null;
  estado: EstadoRpcJwtPostgres;
  formato: FormatoRespostaRpcJwt;
  jwtPostgresDisponivel: boolean | null;
  jwtPostgresCoincideComAuth: boolean | null;
};

export type DiagnosticoVinculo = {
  sessaoAutenticada: boolean;
  usuarioConfirmadoNoAuth: boolean;
  idsDaSessaoEAuthCoincidem: boolean;
  emailDaSessaoConfereComInformado: boolean | null;
  sessaoEstavelDuranteDiagnostico: boolean;
  vinculoVisivelPelaRls: boolean;
  perfilVisivel: string | null;
  consultaSemErro: boolean;
  jwtPostgresDisponivel: boolean | null;
  jwtPostgresCoincideComAuth: boolean | null;
  jwtRpcMetodo: MetodoRpcJwt;
  jwtRpcHttpStatus: number | null;
  jwtRpcCorpoVazio: boolean | null;
  jwtRpcEstado: EstadoRpcJwtPostgres;
  jwtRpcFormato: FormatoRespostaRpcJwt;
  jwtRpcGetDiagnostico: ResumoSondaRpcJwt | null;
  orientacao: string;
};

type ErroRpcEstruturado = {
  message?: string;
  code?: string;
  name?: string;
};

type RespostaRpcIdentidade = {
  data: unknown;
  error: unknown;
  status?: number;
};

type FetchCompat = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ChamadaRpcInstrumentavel = PromiseLike<RespostaRpcIdentidade> & {
  fetch?: FetchCompat;
  method?: string;
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
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
    options?: { get?: boolean; head?: boolean },
  ) => ChamadaRpcInstrumentavel;
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

type MetadadosTransporteRpc = {
  metodo: MetodoRpcJwt;
  httpStatus: number | null;
  corpoVazio: boolean | null;
  jsonNullLiteral: boolean | null;
  erroTransporte: 'timeout' | 'rede' | null;
};

type AnaliseRpcIdentidade = {
  metodo: MetodoRpcJwt;
  httpStatus: number | null;
  corpoVazio: boolean | null;
  estado: EstadoRpcJwtPostgres;
  formato: FormatoRespostaRpcJwt;
  identidadeSql: string | null;
  jwtPostgresDisponivel: boolean | null;
};

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function classificarErroTransporte(erro: unknown): 'timeout' | 'rede' {
  if (ehObjetoSimples(erro)) {
    const nome = typeof erro.name === 'string' ? erro.name : '';
    const msg = typeof erro.message === 'string' ? erro.message.toLowerCase() : '';
    if (
      nome === 'AbortError' ||
      nome === 'TimeoutError' ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('aborted')
    ) {
      return 'timeout';
    }
  }
  return 'rede';
}

function classificarErroSdkRpc(
  erro: unknown,
  httpStatus: number | null,
  erroTransporte: 'timeout' | 'rede' | null,
): EstadoRpcJwtPostgres {
  if (httpStatus === 401) return 'nao_autorizado_401';
  if (httpStatus === 403) return 'proibido_403';
  if (erroTransporte === 'timeout') return 'timeout';
  if (erroTransporte === 'rede') return 'erro_rede';
  if (ehObjetoSimples(erro)) {
    const e = erro as ErroRpcEstruturado;
    const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
    const nome = typeof e.name === 'string' ? e.name : '';
    if (
      nome === 'AbortError' ||
      nome === 'TimeoutError' ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('aborterror')
    ) {
      return 'timeout';
    }
    if (httpStatus === 0 || msg.includes('fetcherror') || msg.includes('network') || msg.includes('failed to fetch')) {
      return 'erro_rede';
    }
  }
  if (httpStatus === 0) return 'erro_rede';
  return 'erro_rpc';
}

function analisarObjetoUsuarioAtualId(
  obj: Record<string, unknown>,
  formatoSucesso: 'objeto_usuario_atual_id' | 'array_objeto_usuario_atual_id',
  base: { metodo: MetodoRpcJwt; httpStatus: number | null; corpoVazio: boolean | null },
): AnaliseRpcIdentidade {
  const chaves = Object.keys(obj);
  if (chaves.length !== 1 || chaves[0] !== 'usuario_atual_id') {
    return {
      ...base,
      estado: 'formato_inesperado',
      formato: 'objeto_inesperado',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  const valor = obj.usuario_atual_id;
  if (valor === null) {
    return {
      ...base,
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
        ...base,
        estado: 'formato_inesperado',
        formato: 'string_vazia',
        identidadeSql: null,
        jwtPostgresDisponivel: null,
      };
    }
    return {
      ...base,
      estado: 'identidade_valida',
      formato: formatoSucesso,
      identidadeSql: limpo,
      jwtPostgresDisponivel: true,
    };
  }
  return {
    ...base,
    estado: 'formato_inesperado',
    formato: 'objeto_inesperado',
    identidadeSql: null,
    jwtPostgresDisponivel: null,
  };
}

/**
 * Classifica o retorno e os metadados HTTP da RPC usuario_atual_id() sem expor
 * UUID, JWT, headers ou corpo bruto. Nunca declara corpo vazio sem comprovação.
 */
function analisarRespostaRpcIdentidade(
  jwtSql: RespostaRpcIdentidade,
  transporte: MetadadosTransporteRpc,
): AnaliseRpcIdentidade {
  const httpStatus =
    transporte.httpStatus ?? (typeof jwtSql.status === 'number' ? jwtSql.status : null);
  const corpoVazio =
    transporte.corpoVazio !== null
      ? transporte.corpoVazio
      : httpStatus === 204
        ? true
        : null;
  const base = { metodo: transporte.metodo, httpStatus, corpoVazio };

  if (jwtSql.error) {
    return {
      ...base,
      estado: classificarErroSdkRpc(jwtSql.error, httpStatus, transporte.erroTransporte),
      formato: 'erro',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  if (httpStatus === 204) {
    return {
      ...base,
      corpoVazio: true,
      estado: 'sem_conteudo_204',
      formato: 'corpo_vazio',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  if (corpoVazio === true && jwtSql.data === null) {
    return {
      ...base,
      estado: 'corpo_vazio_200',
      formato: 'corpo_vazio',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  const dados = jwtSql.data;
  if (dados === null) {
    return {
      ...base,
      corpoVazio: transporte.jsonNullLiteral === true ? false : corpoVazio,
      estado: 'sql_null',
      formato: 'null',
      identidadeSql: null,
      jwtPostgresDisponivel: false,
    };
  }
  if (dados === undefined) {
    return {
      ...base,
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
        ...base,
        estado: 'formato_inesperado',
        formato: 'string_vazia',
        identidadeSql: null,
        jwtPostgresDisponivel: null,
      };
    }
    return {
      ...base,
      estado: 'identidade_valida',
      formato: 'string',
      identidadeSql: limpo,
      jwtPostgresDisponivel: true,
    };
  }
  if (Array.isArray(dados)) {
    if (dados.length === 0) {
      return {
        ...base,
        estado: 'formato_inesperado',
        formato: 'array_vazio',
        identidadeSql: null,
        jwtPostgresDisponivel: null,
      };
    }
    if (dados.length > 1) {
      return {
        ...base,
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
          ...base,
          estado: 'formato_inesperado',
          formato: 'string_vazia',
          identidadeSql: null,
          jwtPostgresDisponivel: null,
        };
      }
      return {
        ...base,
        estado: 'identidade_valida',
        formato: 'array_string',
        identidadeSql: limpo,
        jwtPostgresDisponivel: true,
      };
    }
    if (ehObjetoSimples(unico)) {
      return analisarObjetoUsuarioAtualId(unico, 'array_objeto_usuario_atual_id', base);
    }
    return {
      ...base,
      estado: 'formato_inesperado',
      formato: 'outro_tipo',
      identidadeSql: null,
      jwtPostgresDisponivel: null,
    };
  }
  if (ehObjetoSimples(dados)) {
    return analisarObjetoUsuarioAtualId(dados, 'objeto_usuario_atual_id', base);
  }
  return {
    ...base,
    estado: 'formato_inesperado',
    formato: 'outro_tipo',
    identidadeSql: null,
    jwtPostgresDisponivel: null,
  };
}

/**
 * Envolve exclusivamente o fetch local da instância PostgrestBuilder desta
 * chamada diagnóstica (sem interceptor global) para distinguir HTTP 200 com
 * JSON `null`, HTTP 200 com corpo vazio e HTTP 204, sem reter o corpo bruto.
 */
async function executarRpcIdentidadeInstrumentada(
  chamada: ChamadaRpcInstrumentavel,
  metodoEsperado: MetodoRpcJwt,
): Promise<{ resposta: RespostaRpcIdentidade; transporte: MetadadosTransporteRpc }> {
  const transporte: MetadadosTransporteRpc = {
    metodo: metodoEsperado,
    httpStatus: null,
    corpoVazio: null,
    jsonNullLiteral: null,
    erroTransporte: null,
  };
  const fetchOriginal = chamada.fetch;
  if (typeof fetchOriginal === 'function') {
    chamada.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const metodoHttp = (init?.method ?? chamada.method ?? metodoEsperado).toUpperCase();
      transporte.metodo = metodoHttp === 'GET' ? 'GET' : 'POST';
      try {
        const resp = await fetchOriginal(input, init);
        transporte.httpStatus = typeof resp.status === 'number' ? resp.status : null;
        if (resp.status === 204) {
          transporte.corpoVazio = true;
          transporte.jsonNullLiteral = false;
        } else if (typeof resp.clone === 'function') {
          try {
            const texto = await resp.clone().text();
            const trimado = texto.trim();
            transporte.corpoVazio = trimado.length === 0;
            transporte.jsonNullLiteral = trimado === 'null';
          } catch {
            transporte.corpoVazio = null;
            transporte.jsonNullLiteral = null;
          }
        }
        return resp;
      } catch (erro) {
        transporte.erroTransporte = classificarErroTransporte(erro);
        throw erro;
      }
    };
  }
  try {
    const resposta = await chamada;
    return { resposta, transporte };
  } catch (erro) {
    if (!transporte.erroTransporte) {
      transporte.erroTransporte = classificarErroTransporte(erro);
    }
    return {
      resposta: {
        data: null,
        error: { name: 'TransportError', message: transporte.erroTransporte },
        status: transporte.httpStatus ?? 0,
      },
      transporte,
    };
  }
}

/**
 * Diagnóstico somente leitura, sem imprimir identificadores, e-mail, JWT ou OTP.
 * Em particular, uma consulta RLS que retorna zero linhas NÃO prova ausência
 * física do vínculo na base de dados, e respostas vazias/inconclusivas da RPC
 * nunca são tratadas como autenticação SQL válida.
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
    sessaoEstavelDuranteDiagnostico: false,
    vinculoVisivelPelaRls: false,
    perfilVisivel: null,
    consultaSemErro: false,
    jwtPostgresDisponivel: null,
    jwtPostgresCoincideComAuth: null,
    jwtRpcMetodo: 'POST',
    jwtRpcHttpStatus: null,
    jwtRpcCorpoVazio: null,
    jwtRpcEstado: 'nao_executado',
    jwtRpcFormato: 'nao_executado',
    jwtRpcGetDiagnostico: null,
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
    sessaoEstavelDuranteDiagnostico: false,
    vinculoVisivelPelaRls: false,
    perfilVisivel: null,
    consultaSemErro: false,
    jwtPostgresDisponivel: null,
    jwtPostgresCoincideComAuth: null,
    jwtRpcHttpStatus: null,
    jwtRpcCorpoVazio: null,
    jwtRpcEstado: 'nao_executado' as const,
    jwtRpcFormato: 'nao_executado' as const,
    jwtRpcGetDiagnostico: null,
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

    // Fluxo principal POST da RPC STABLE existente (SELECT auth.uid()).
    // Nenhum UUID, JWT ou payload bruto é retornado à interface.
    const chamadaPost = cliente.rpc('usuario_atual_id');
    const { resposta: jwtSql, transporte: transportePost } =
      await executarRpcIdentidadeInstrumentada(chamadaPost, 'POST');
    if (alterouSessao) return invalido();
    const analiseRpc = analisarRespostaRpcIdentidade(jwtSql, transportePost);
    const identidadeSql = analiseRpc.identidadeSql;
    const jwtPostgresDisponivel = analiseRpc.jwtPostgresDisponivel;
    const jwtPostgresCoincideComAuth = jwtSql.error || !identidadeSql
      ? null : identidadeSql === idInicial;

    // Sonda diagnóstica GET da mesma RPC STABLE (não substitui o fluxo POST).
    const chamadaGet = cliente.rpc('usuario_atual_id', {}, { get: true });
    const { resposta: jwtSqlGet, transporte: transporteGet } =
      await executarRpcIdentidadeInstrumentada(chamadaGet, 'GET');
    if (alterouSessao) return invalido();
    const analiseRpcGet = analisarRespostaRpcIdentidade(jwtSqlGet, transporteGet);
    const resumoRpcGet: ResumoSondaRpcJwt = {
      metodo: analiseRpcGet.metodo,
      httpStatus: analiseRpcGet.httpStatus,
      corpoVazio: analiseRpcGet.corpoVazio,
      estado: analiseRpcGet.estado,
      formato: analiseRpcGet.formato,
      jwtPostgresDisponivel: analiseRpcGet.jwtPostgresDisponivel,
      jwtPostgresCoincideComAuth:
        jwtSqlGet.error || !analiseRpcGet.identidadeSql
          ? null
          : analiseRpcGet.identidadeSql === idInicial,
    };

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
    resultado.sessaoEstavelDuranteDiagnostico = true;
    resultado.jwtPostgresDisponivel = jwtPostgresDisponivel;
    resultado.jwtPostgresCoincideComAuth = jwtPostgresCoincideComAuth;
    resultado.jwtRpcMetodo = analiseRpc.metodo;
    resultado.jwtRpcHttpStatus = analiseRpc.httpStatus;
    resultado.jwtRpcCorpoVazio = analiseRpc.corpoVazio;
    resultado.jwtRpcEstado = analiseRpc.estado;
    resultado.jwtRpcFormato = analiseRpc.formato;
    resultado.jwtRpcGetDiagnostico = resumoRpcGet;
    if (perfil.error) {
      return { ...resultado, orientacao: 'Consulta da RLS retornou erro. O diagnóstico não revela mensagens técnicas sensíveis.' };
    }
    if (perfil.data && perfil.data.user_id !== idInicial) return invalido();
    resultado.consultaSemErro = true;
    resultado.vinculoVisivelPelaRls = Boolean(perfil.data);
    resultado.perfilVisivel = perfil.data?.perfil ?? null;
    resultado.orientacao =
      analiseRpc.estado === 'nao_autorizado_401' || analiseRpc.estado === 'proibido_403'
        ? 'RPC de identidade PostgreSQL recusada por autorização HTTP (401/403). Não considerar identidade SQL confirmada.'
        : analiseRpc.estado === 'timeout' || analiseRpc.estado === 'erro_rede'
          ? 'Falha de rede ou timeout na RPC de identidade PostgreSQL. Resultado inconclusivo.'
          : jwtSql.error
            ? 'RPC de identidade PostgreSQL indisponível. Não é possível concluir se o JWT chegou ao SQL; verificar configuração de exposição e grants.'
            : analiseRpc.estado === 'sem_conteudo_204' || analiseRpc.estado === 'corpo_vazio_200'
              ? 'RPC usuario_atual_id() retornou resposta HTTP vazia (sem corpo JSON). Resultado inconclusivo; investigar transporte/proxy da Data API.'
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
    return { ...resultado, sessaoEstavelDuranteDiagnostico: false, vinculoVisivelPelaRls: false, perfilVisivel: null,
      consultaSemErro: false,
      jwtPostgresDisponivel: null,
      jwtPostgresCoincideComAuth: null,
      jwtRpcHttpStatus: null,
      jwtRpcCorpoVazio: null,
      jwtRpcEstado: 'nao_executado',
      jwtRpcFormato: 'nao_executado',
      jwtRpcGetDiagnostico: null,
      orientacao: 'Falha ao diagnosticar autenticação ou leitura. Nenhuma alteração foi executada.' };
  } finally {
    subscription.unsubscribe();
  }
}
