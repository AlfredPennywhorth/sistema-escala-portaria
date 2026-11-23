import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * Carrega e executa a implementação REAL de diagnosticarVinculoNeonHml
 * sem conexão com bancos, rede ou SDK externo.
 */
async function carregarServicoReal() {
  const sourcePath = new URL('../src/services/neon/authVinculoDiagnosticHmlService.ts', import.meta.url);
  const rawSource = readFileSync(sourcePath, 'utf8');
  const stubbedSource = rawSource.replace(
    /import\s*\{\s*criarClienteNeon\s*\}\s*from\s*['"]\.\.\/\.\.\/lib\/neon['"];?/,
    'function criarClienteNeon() { throw new Error("criarClienteNeon nao deve ser chamado nos testes offline"); }',
  );
  const { outputText } = ts.transpileModule(stubbedSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const encoded = Buffer.from(outputText, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

const servico = await carregarServicoReal();
const { diagnosticarVinculoNeonHml } = servico;

const HML_ENV = { VITE_NEON_HOMOLOGACAO_ENABLED: 'true' };
const USER_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_USER_ID = '99999999-8888-7777-6666-555555555555';
const SECRET_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.segredo_jwt_teste.assinatura';
const SECRET_EMAIL = 'coordenadora.secreta@exemplo.org';

function criarClienteSimulado(config = {}) {
  let listener = null;
  let unsubscribed = false;
  let getSessionCalls = 0;
  let getUserCalls = 0;
  const rpcsChamadas = [];
  const tabelasChamadas = [];

  const sessionPadrao = {
    data: { session: { user: { id: USER_ID }, access_token: SECRET_TOKEN } },
    error: null,
  };
  const userPadrao = {
    data: { user: { id: USER_ID, email: SECRET_EMAIL } },
    error: null,
  };

  const cliente = {
    auth: {
      onAuthStateChange(cb) {
        listener = cb;
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribed = true;
              },
            },
          },
        };
      },
      async getSession() {
        getSessionCalls += 1;
        if (config.onGetSession) {
          return config.onGetSession(getSessionCalls, (ev) => listener?.(ev));
        }
        return sessionPadrao;
      },
      async getUser() {
        getUserCalls += 1;
        if (config.onGetUser) {
          return config.onGetUser(getUserCalls, (ev) => listener?.(ev));
        }
        return userPadrao;
      },
    },
    async rpc(fn) {
      rpcsChamadas.push(fn);
      if (config.onRpc) {
        return config.onRpc(fn, (ev) => listener?.(ev));
      }
      return { data: USER_ID, error: null };
    },
    from(tabela) {
      tabelasChamadas.push(tabela);
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  if (config.onRls) {
                    return config.onRls((ev) => listener?.(ev));
                  }
                  return {
                    data: { user_id: USER_ID, perfil: 'coordenadora' },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    cliente,
    dispararEvento: (ev) => listener?.(ev),
    foiDesinscrito: () => unsubscribed,
    rpcsChamadas,
    tabelasChamadas,
  };
}

function assertSemDadosSensiveis(resultado, termosExtras = []) {
  const texto = JSON.stringify(resultado);
  for (const segredo of [USER_ID, OTHER_USER_ID, SECRET_TOKEN, SECRET_EMAIL, ...termosExtras]) {
    assert.ok(!texto.includes(segredo), `Resultado expôs dado sensível: ${segredo}`);
  }
}

test('1. RPC com identidade válida (string) e vínculo RLS visível', async () => {
  const mock = criarClienteSimulado({
    onRpc: async () => ({ data: USER_ID, error: null }),
    onRls: async () => ({ data: { user_id: USER_ID, perfil: 'coordenadora' }, error: null }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.sessaoAutenticada, true);
  assert.equal(res.usuarioConfirmadoNoAuth, true);
  assert.equal(res.idsDaSessaoEAuthCoincidem, true);
  assert.equal(res.emailDaSessaoConfereComInformado, true);
  assert.equal(res.jwtPostgresDisponivel, true);
  assert.equal(res.jwtPostgresCoincideComAuth, true);
  assert.equal(res.jwtRpcEstado, 'identidade_valida');
  assert.equal(res.jwtRpcFormato, 'string');
  assert.equal(res.vinculoVisivelPelaRls, true);
  assert.equal(res.perfilVisivel, 'coordenadora');
  assert.equal(res.consultaSemErro, true);
  assert.deepEqual(mock.rpcsChamadas, ['usuario_atual_id']);
  assert.equal(mock.foiDesinscrito(), true);
  assertSemDadosSensiveis(res);
});

test('1b. RPC encapsulada por PostgREST (objeto ou array de 1 item) extrai identidade e registra formato', async () => {
  const casos = [
    { payload: { usuario_atual_id: USER_ID }, formato: 'objeto_usuario_atual_id' },
    { payload: [{ usuario_atual_id: USER_ID }], formato: 'array_objeto_usuario_atual_id' },
    { payload: [USER_ID], formato: 'array_string' },
  ];
  for (const caso of casos) {
    const mock = criarClienteSimulado({
      onRpc: async () => ({ data: caso.payload, error: null }),
    });
    const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
    assert.equal(res.jwtPostgresDisponivel, true, caso.formato);
    assert.equal(res.jwtPostgresCoincideComAuth, true, caso.formato);
    assert.equal(res.jwtRpcEstado, 'identidade_valida', caso.formato);
    assert.equal(res.jwtRpcFormato, caso.formato);
    assertSemDadosSensiveis(res);
  }
});

test('1c. RPC com identidade SQL divergente da sessão Auth', async () => {
  const mock = criarClienteSimulado({
    onRpc: async () => ({ data: OTHER_USER_ID, error: null }),
    onRls: async () => ({ data: null, error: null }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.jwtPostgresDisponivel, true);
  assert.equal(res.jwtPostgresCoincideComAuth, false);
  assert.equal(res.jwtRpcEstado, 'identidade_valida');
  assert.match(res.orientacao, /Identidade do JWT PostgreSQL difere da sessão Neon Auth/);
  assertSemDadosSensiveis(res);
});

test('2. RPC com retorno SQL NULL (sem vínculo RLS e com vínculo RLS contraditório)', async () => {
  const semVinculo = criarClienteSimulado({
    onRpc: async () => ({ data: null, error: null }),
    onRls: async () => ({ data: null, error: null }),
  });
  const res1 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: semVinculo.cliente, env: HML_ENV });
  assert.equal(res1.jwtPostgresDisponivel, false);
  assert.equal(res1.jwtPostgresCoincideComAuth, null);
  assert.equal(res1.jwtRpcEstado, 'sql_null');
  assert.equal(res1.jwtRpcFormato, 'null');
  assert.equal(res1.vinculoVisivelPelaRls, false);
  assert.match(res1.orientacao, /Identidade JWT ausente no contexto PostgreSQL/);
  assertSemDadosSensiveis(res1);

  const comVinculo = criarClienteSimulado({
    onRpc: async () => ({ data: null, error: null }),
    onRls: async () => ({ data: { user_id: USER_ID, perfil: 'coordenadora' }, error: null }),
  });
  const res2 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: comVinculo.cliente, env: HML_ENV });
  assert.equal(res2.jwtPostgresDisponivel, false);
  assert.equal(res2.jwtPostgresCoincideComAuth, null);
  assert.equal(res2.jwtRpcEstado, 'sql_null');
  assert.equal(res2.vinculoVisivelPelaRls, true);
  assert.equal(res2.perfilVisivel, 'coordenadora');
  assert.match(res2.orientacao, /Divergência detectada/);
  assertSemDadosSensiveis(res2);
});

test('3. RPC com erro não mascara como SQL NULL e não expõe detalhes técnicos', async () => {
  const erroTecnico = 'permission denied for function usuario_atual_id (pg_internal_secret)';
  const mock = criarClienteSimulado({
    onRpc: async () => ({ data: null, error: { message: erroTecnico, code: '42501' } }),
    onRls: async () => ({ data: null, error: null }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.jwtPostgresDisponivel, null);
  assert.equal(res.jwtPostgresCoincideComAuth, null);
  assert.equal(res.jwtRpcEstado, 'erro_rpc');
  assert.equal(res.jwtRpcFormato, 'erro');
  assert.equal(res.consultaSemErro, true);
  assert.match(res.orientacao, /RPC de identidade PostgreSQL indisponível/);
  assertSemDadosSensiveis(res, [erroTecnico, 'pg_internal_secret']);
});

test('4. Formatos inesperados da RPC nunca são tratados como sucesso nem como SQL NULL', async () => {
  const casos = [
    { payload: undefined, formato: 'undefined' },
    { payload: '   ', formato: 'string_vazia' },
    { payload: [], formato: 'array_vazio' },
    { payload: [USER_ID, OTHER_USER_ID], formato: 'array_multiplo' },
    { payload: { id_errado: USER_ID }, formato: 'objeto_inesperado' },
    { payload: { usuario_atual_id: USER_ID, extra: 'x' }, formato: 'objeto_inesperado' },
    { payload: 12345, formato: 'outro_tipo' },
  ];
  for (const caso of casos) {
    const mock = criarClienteSimulado({
      onRpc: async () => ({ data: caso.payload, error: null }),
      onRls: async () => ({ data: { user_id: USER_ID, perfil: 'coordenadora' }, error: null }),
    });
    const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
    assert.equal(res.jwtPostgresDisponivel, null, caso.formato);
    assert.equal(res.jwtPostgresCoincideComAuth, null, caso.formato);
    assert.equal(res.jwtRpcEstado, 'formato_inesperado', caso.formato);
    assert.equal(res.jwtRpcFormato, caso.formato);
    assert.equal(res.vinculoVisivelPelaRls, true);
    assert.match(res.orientacao, /Formato inesperado na resposta da RPC usuario_atual_id/);
    assertSemDadosSensiveis(res);
  }
});

test('5 e 6. Consulta RLS com vínculo visível vs sem vínculo (com JWT SQL válido)', async () => {
  const semVinculo = criarClienteSimulado({
    onRpc: async () => ({ data: USER_ID, error: null }),
    onRls: async () => ({ data: null, error: null }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: semVinculo.cliente, env: HML_ENV });
  assert.equal(res.jwtPostgresDisponivel, true);
  assert.equal(res.jwtPostgresCoincideComAuth, true);
  assert.equal(res.consultaSemErro, true);
  assert.equal(res.vinculoVisivelPelaRls, false);
  assert.equal(res.perfilVisivel, null);
  assert.match(res.orientacao, /nenhum vínculo visível pela RLS/);
  assertSemDadosSensiveis(res);
});

test('7. Consulta RLS com erro de permissão preserva indicadores JWT após revalidação sem vazar erro', async () => {
  const erroRls = 'new row violates row-level security policy or permission denied on table usuarios_auxiliares';
  const mock = criarClienteSimulado({
    onRpc: async () => ({ data: USER_ID, error: null }),
    onRls: async () => ({ data: null, error: { message: erroRls, code: '42501' } }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.jwtPostgresDisponivel, true);
  assert.equal(res.jwtPostgresCoincideComAuth, true);
  assert.equal(res.jwtRpcEstado, 'identidade_valida');
  assert.equal(res.jwtRpcFormato, 'string');
  assert.equal(res.consultaSemErro, false);
  assert.equal(res.vinculoVisivelPelaRls, false);
  assert.equal(res.perfilVisivel, null);
  assert.match(res.orientacao, /Consulta da RLS retornou erro/);
  assertSemDadosSensiveis(res, [erroRls]);
});

test('8. Troca de sessão durante a execução descarta todo resultado (inclusive A -> B -> A)', async () => {
  const mockEvento = criarClienteSimulado({
    onRls: async (emit) => {
      emit('SIGNED_OUT');
      emit('SIGNED_IN');
      return { data: { user_id: USER_ID, perfil: 'admin' }, error: null };
    },
  });
  const res1 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockEvento.cliente, env: HML_ENV });
  assert.equal(res1.vinculoVisivelPelaRls, false);
  assert.equal(res1.perfilVisivel, null);
  assert.equal(res1.consultaSemErro, false);
  assert.equal(res1.jwtPostgresDisponivel, null);
  assert.equal(res1.jwtPostgresCoincideComAuth, null);
  assert.equal(res1.jwtRpcEstado, 'nao_executado');
  assert.match(res1.orientacao, /Sessão Neon alterada durante o diagnóstico/);
  assert.equal(mockEvento.foiDesinscrito(), true);
  assertSemDadosSensiveis(res1);

  const mockOutroId = criarClienteSimulado({
    onRls: async () => ({ data: { user_id: OTHER_USER_ID, perfil: 'admin' }, error: null }),
  });
  const res2 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockOutroId.cliente, env: HML_ENV });
  assert.equal(res2.vinculoVisivelPelaRls, false);
  assert.equal(res2.perfilVisivel, null);
  assert.equal(res2.jwtPostgresDisponivel, null);
  assert.match(res2.orientacao, /Sessão Neon alterada durante o diagnóstico/);
  assertSemDadosSensiveis(res2);
});

test('9. Renovação ou alteração de token durante o diagnóstico invalida resultado', async () => {
  const mockTokenAlterado = criarClienteSimulado({
    onGetSession: async (call) => ({
      data: {
        session: {
          user: { id: USER_ID },
          access_token: call === 1 ? SECRET_TOKEN : `${SECRET_TOKEN}_renovado`,
        },
      },
      error: null,
    }),
  });
  const res1 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockTokenAlterado.cliente, env: HML_ENV });
  assert.equal(res1.vinculoVisivelPelaRls, false);
  assert.equal(res1.perfilVisivel, null);
  assert.equal(res1.consultaSemErro, false);
  assert.equal(res1.jwtPostgresDisponivel, null);
  assert.match(res1.orientacao, /Sessão Neon alterada durante o diagnóstico/);
  assertSemDadosSensiveis(res1);

  const mockEventoRefresh = criarClienteSimulado({
    onRpc: async (_fn, emit) => {
      emit('TOKEN_REFRESHED');
      return { data: USER_ID, error: null };
    },
  });
  const res2 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockEventoRefresh.cliente, env: HML_ENV });
  assert.equal(res2.vinculoVisivelPelaRls, false);
  assert.equal(res2.jwtPostgresDisponivel, null);
  assert.match(res2.orientacao, /Sessão Neon alterada durante o diagnóstico/);
  assertSemDadosSensiveis(res2);
});

test('10. Fail-closed fora da homologação e unsubscribe garantido em exceção', async () => {
  const mockDesabilitado = criarClienteSimulado();
  const resOff = await diagnosticarVinculoNeonHml(SECRET_EMAIL, {
    cliente: mockDesabilitado.cliente,
    env: { VITE_NEON_HOMOLOGACAO_ENABLED: 'false' },
  });
  assert.equal(resOff.sessaoAutenticada, false);
  assert.deepEqual(mockDesabilitado.rpcsChamadas, []);
  assert.deepEqual(mockDesabilitado.tabelasChamadas, []);
  assert.match(resOff.orientacao, /somente na homologação Neon/);

  const mockExcecao = criarClienteSimulado({
    onRpc: async () => {
      throw new Error(`falha interna ${SECRET_TOKEN} ${USER_ID}`);
    },
  });
  const resErr = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockExcecao.cliente, env: HML_ENV });
  assert.equal(resErr.consultaSemErro, false);
  assert.equal(resErr.vinculoVisivelPelaRls, false);
  assert.equal(resErr.jwtPostgresDisponivel, null);
  assert.equal(mockExcecao.foiDesinscrito(), true);
  assertSemDadosSensiveis(resErr);
});
