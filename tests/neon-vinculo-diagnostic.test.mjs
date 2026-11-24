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

/**
 * Simula um PostgrestBuilder fiel ao @neondatabase/neon-js 0.9.0-beta:
 * expõe `.fetch` e `.method` próprios da instância e só dispara o fetch em `.then()`.
 */
function criarBuilderPostgrestSimulado({ method = 'POST', fetchImpl }) {
  const builder = {
    method,
    fetch: fetchImpl,
    then(resolve, reject) {
      const executar = async () => {
        try {
          const resp = await builder.fetch('https://example.apirest.neon.tech/rest/v1/rpc/usuario_atual_id', {
            method: builder.method,
            headers: { Authorization: `Bearer ${SECRET_TOKEN}` },
          });
          const status = resp.status;
          if (resp.ok) {
            const texto = await resp.text();
            const data = texto === '' ? null : JSON.parse(texto);
            return { data, error: null, status, statusText: resp.statusText ?? 'OK' };
          }
          const textoErro = await resp.text();
          return {
            data: null,
            error: { message: textoErro || `HTTP ${status}`, code: String(status) },
            status,
            statusText: resp.statusText ?? 'Error',
          };
        } catch (err) {
          return {
            data: null,
            error: {
              name: err?.name ?? 'FetchError',
              message: `${err?.name ?? 'FetchError'}: ${err?.message ?? 'network'}`,
              code: err?.code ?? '',
            },
            status: 0,
            statusText: '',
          };
        }
      };
      return executar().then(resolve, reject);
    },
  };
  return builder;
}

function criarResponseSimulada(status, bodyText) {
  const ok = status >= 200 && status < 300;
  const make = () => ({
    status,
    ok,
    statusText: ok ? 'OK' : 'Error',
    async text() {
      return bodyText;
    },
    clone() {
      return make();
    },
  });
  return make();
}

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
    rpc(fn, args, options) {
      const metodo = options?.get ? 'GET' : 'POST';
      rpcsChamadas.push({ fn, metodo });
      if (config.onRpcBuilder) {
        return config.onRpcBuilder(fn, metodo, (ev) => listener?.(ev));
      }
      if (config.onRpc) {
        return Promise.resolve().then(() => config.onRpc(fn, metodo, (ev) => listener?.(ev)));
      }
      return criarBuilderPostgrestSimulado({
        method: metodo,
        fetchImpl: async () => criarResponseSimulada(200, JSON.stringify(USER_ID)),
      });
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
        insert() { throw new Error('Escrita proibida no diagnóstico'); },
        update() { throw new Error('Escrita proibida no diagnóstico'); },
        delete() { throw new Error('Escrita proibida no diagnóstico'); },
        upsert() { throw new Error('Escrita proibida no diagnóstico'); },
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
  for (const segredo of [USER_ID, OTHER_USER_ID, SECRET_TOKEN, SECRET_EMAIL, 'Bearer ', 'Authorization', ...termosExtras]) {
    assert.ok(!texto.includes(segredo), `Resultado expôs dado sensível: ${segredo}`);
  }
}

test('1. HTTP 200 com identidade válida (POST e sonda GET) e vínculo RLS visível', async () => {
  const mock = criarClienteSimulado();
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.sessaoAutenticada, true);
  assert.equal(res.usuarioConfirmadoNoAuth, true);
  assert.equal(res.idsDaSessaoEAuthCoincidem, true);
  assert.equal(res.emailDaSessaoConfereComInformado, true);
  assert.equal(res.sessaoEstavelDuranteDiagnostico, true);
  assert.equal(res.jwtPostgresDisponivel, true);
  assert.equal(res.jwtPostgresCoincideComAuth, true);
  assert.equal(res.jwtRpcMetodo, 'POST');
  assert.equal(res.jwtRpcHttpStatus, 200);
  assert.equal(res.jwtRpcCorpoVazio, false);
  assert.equal(res.jwtRpcEstado, 'identidade_valida');
  assert.equal(res.jwtRpcFormato, 'string');
  assert.equal(res.jwtRpcGetDiagnostico?.metodo, 'GET');
  assert.equal(res.jwtRpcGetDiagnostico?.httpStatus, 200);
  assert.equal(res.jwtRpcGetDiagnostico?.corpoVazio, false);
  assert.equal(res.jwtRpcGetDiagnostico?.estado, 'identidade_valida');
  assert.equal(res.jwtRpcGetDiagnostico?.jwtPostgresCoincideComAuth, true);
  assert.equal(res.vinculoVisivelPelaRls, true);
  assert.equal(res.perfilVisivel, 'coordenadora');
  assert.equal(res.consultaSemErro, true);
  assert.deepEqual(mock.rpcsChamadas, [
    { fn: 'usuario_atual_id', metodo: 'POST' },
    { fn: 'usuario_atual_id', metodo: 'GET' },
  ]);
  assert.equal(mock.foiDesinscrito(), true);
  assertSemDadosSensiveis(res);
});

test('2. HTTP 200 com JSON null (com e sem vínculo RLS) distingue corpo não vazio de vazio', async () => {
  const mock = criarClienteSimulado({
    onRpcBuilder: (_fn, metodo) => criarBuilderPostgrestSimulado({
      method: metodo,
      fetchImpl: async () => criarResponseSimulada(200, metodo === 'POST' ? 'null' : JSON.stringify(USER_ID)),
    }),
    onRls: async () => ({ data: { user_id: USER_ID, perfil: 'coordenadora' }, error: null }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.jwtRpcHttpStatus, 200);
  assert.equal(res.jwtRpcCorpoVazio, false);
  assert.equal(res.jwtRpcEstado, 'sql_null');
  assert.equal(res.jwtRpcFormato, 'null');
  assert.equal(res.jwtPostgresDisponivel, false);
  assert.equal(res.jwtPostgresCoincideComAuth, null);
  // A sonda GET NÃO sobrescreve o resultado POST principal
  assert.equal(res.jwtRpcGetDiagnostico?.estado, 'identidade_valida');
  assert.equal(res.jwtRpcGetDiagnostico?.jwtPostgresCoincideComAuth, true);
  assert.equal(res.vinculoVisivelPelaRls, true);
  assert.match(res.orientacao, /Divergência detectada/);
  assertSemDadosSensiveis(res);
});

test('3. HTTP 200 com corpo vazio é classificado como inconclusivo (nunca aprovado nem sql_null)', async () => {
  const mock = criarClienteSimulado({
    onRpcBuilder: (_fn, metodo) => criarBuilderPostgrestSimulado({
      method: metodo,
      fetchImpl: async () => criarResponseSimulada(200, ''),
    }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.jwtRpcHttpStatus, 200);
  assert.equal(res.jwtRpcCorpoVazio, true);
  assert.equal(res.jwtRpcEstado, 'corpo_vazio_200');
  assert.equal(res.jwtRpcFormato, 'corpo_vazio');
  assert.equal(res.jwtPostgresDisponivel, null);
  assert.equal(res.jwtPostgresCoincideComAuth, null);
  assert.match(res.orientacao, /resposta HTTP vazia/);
  assertSemDadosSensiveis(res);
});

test('4. HTTP 204 sem conteúdo é classificado como sem_conteudo_204 e inconclusivo', async () => {
  const mock = criarClienteSimulado({
    onRpcBuilder: (_fn, metodo) => criarBuilderPostgrestSimulado({
      method: metodo,
      fetchImpl: async () => criarResponseSimulada(204, ''),
    }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.jwtRpcHttpStatus, 204);
  assert.equal(res.jwtRpcCorpoVazio, true);
  assert.equal(res.jwtRpcEstado, 'sem_conteudo_204');
  assert.equal(res.jwtRpcFormato, 'corpo_vazio');
  assert.equal(res.jwtPostgresDisponivel, null);
  assert.equal(res.jwtPostgresCoincideComAuth, null);
  assert.match(res.orientacao, /resposta HTTP vazia/);
  assertSemDadosSensiveis(res);
});

test('5. HTTP 401 e HTTP 403 são distinguidos sem expor detalhes técnicos', async () => {
  for (const caso of [
    { status: 401, estado: 'nao_autorizado_401', body: `JWT expired ${SECRET_TOKEN}` },
    { status: 403, estado: 'proibido_403', body: `permission denied for ${USER_ID}` },
  ]) {
    const mock = criarClienteSimulado({
      onRpcBuilder: (_fn, metodo) => criarBuilderPostgrestSimulado({
        method: metodo,
        fetchImpl: async () => criarResponseSimulada(caso.status, caso.body),
      }),
    });
    const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
    assert.equal(res.jwtRpcHttpStatus, caso.status);
    assert.equal(res.jwtRpcEstado, caso.estado);
    assert.equal(res.jwtRpcFormato, 'erro');
    assert.equal(res.jwtPostgresDisponivel, null);
    assert.equal(res.jwtPostgresCoincideComAuth, null);
    assert.match(res.orientacao, /recusada por autorização HTTP/);
    assertSemDadosSensiveis(res, [caso.body, 'JWT expired', 'permission denied']);
  }
});

test('6. Erro de rede e timeout são distinguidos como inconclusivos sem expor stack', async () => {
  const mockRede = criarClienteSimulado({
    onRpcBuilder: (_fn, metodo) => criarBuilderPostgrestSimulado({
      method: metodo,
      fetchImpl: async () => {
        throw new TypeError(`Failed to fetch ${SECRET_TOKEN}`);
      },
    }),
  });
  const resRede = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockRede.cliente, env: HML_ENV });
  assert.equal(resRede.jwtRpcEstado, 'erro_rede');
  assert.equal(resRede.jwtPostgresDisponivel, null);
  assert.equal(resRede.jwtPostgresCoincideComAuth, null);
  assert.match(resRede.orientacao, /Falha de rede ou timeout/);
  assertSemDadosSensiveis(resRede, ['Failed to fetch']);

  const mockTimeout = criarClienteSimulado({
    onRpcBuilder: (_fn, metodo) => criarBuilderPostgrestSimulado({
      method: metodo,
      fetchImpl: async () => {
        const e = new Error('The operation timed out');
        e.name = 'AbortError';
        throw e;
      },
    }),
  });
  const resTimeout = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockTimeout.cliente, env: HML_ENV });
  assert.equal(resTimeout.jwtRpcEstado, 'timeout');
  assert.equal(resTimeout.jwtPostgresDisponivel, null);
  assert.equal(resTimeout.jwtPostgresCoincideComAuth, null);
  assert.match(resTimeout.orientacao, /Falha de rede ou timeout/);
  assertSemDadosSensiveis(resTimeout, ['The operation timed out']);
});

test('7. Sem transporte instrumentável, jwtRpcCorpoVazio permanece null (nunca presumido)', async () => {
  const mock = criarClienteSimulado({
    onRpc: async () => ({ data: null, error: null, status: 200 }),
    onRls: async () => ({ data: null, error: null }),
  });
  const res = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mock.cliente, env: HML_ENV });
  assert.equal(res.jwtRpcHttpStatus, 200);
  assert.equal(res.jwtRpcCorpoVazio, null);
  assert.equal(res.jwtRpcEstado, 'sql_null');
  assert.equal(res.jwtPostgresDisponivel, false);
  assert.match(res.orientacao, /Identidade JWT ausente no contexto PostgreSQL/);
  assertSemDadosSensiveis(res);
});

test('8. Formatos inesperados e erro RLS preservam segurança e indicadores após revalidação', async () => {
  const erroRls = `RLS denied ${USER_ID}`;
  const mockErroRls = criarClienteSimulado({
    onRls: async () => ({ data: null, error: { message: erroRls, code: '42501' } }),
  });
  const resRls = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockErroRls.cliente, env: HML_ENV });
  assert.equal(resRls.sessaoEstavelDuranteDiagnostico, true);
  assert.equal(resRls.jwtPostgresDisponivel, true);
  assert.equal(resRls.jwtPostgresCoincideComAuth, true);
  assert.equal(resRls.consultaSemErro, false);
  assert.match(resRls.orientacao, /Consulta da RLS retornou erro/);
  assertSemDadosSensiveis(resRls, [erroRls]);

  for (const payload of [undefined, '  ', [], [USER_ID, OTHER_USER_ID], { outro: USER_ID }, 42]) {
    const mockFmt = criarClienteSimulado({
      onRpc: async () => ({ data: payload, error: null, status: 200 }),
    });
    const resFmt = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockFmt.cliente, env: HML_ENV });
    assert.equal(resFmt.jwtRpcEstado, 'formato_inesperado');
    assert.equal(resFmt.jwtPostgresDisponivel, null);
    assert.equal(resFmt.jwtPostgresCoincideComAuth, null);
    assertSemDadosSensiveis(resFmt);
  }
});

test('9. Sessão ou token alterados durante o diagnóstico descartam todos os indicadores', async () => {
  const mockEvento = criarClienteSimulado({
    onRls: async (emit) => {
      emit('SIGNED_OUT');
      emit('SIGNED_IN');
      return { data: { user_id: USER_ID, perfil: 'admin' }, error: null };
    },
  });
  const res1 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockEvento.cliente, env: HML_ENV });
  assert.equal(res1.sessaoEstavelDuranteDiagnostico, false);
  assert.equal(res1.vinculoVisivelPelaRls, false);
  assert.equal(res1.perfilVisivel, null);
  assert.equal(res1.consultaSemErro, false);
  assert.equal(res1.jwtPostgresDisponivel, null);
  assert.equal(res1.jwtRpcHttpStatus, null);
  assert.equal(res1.jwtRpcCorpoVazio, null);
  assert.equal(res1.jwtRpcGetDiagnostico, null);
  assert.match(res1.orientacao, /Sessão Neon alterada durante o diagnóstico/);
  assert.equal(mockEvento.foiDesinscrito(), true);

  const mockToken = criarClienteSimulado({
    onGetSession: async (call) => ({
      data: {
        session: {
          user: { id: USER_ID },
          access_token: call === 1 ? SECRET_TOKEN : `${SECRET_TOKEN}_novo`,
        },
      },
      error: null,
    }),
  });
  const res2 = await diagnosticarVinculoNeonHml(SECRET_EMAIL, { cliente: mockToken.cliente, env: HML_ENV });
  assert.equal(res2.sessaoEstavelDuranteDiagnostico, false);
  assert.equal(res2.jwtPostgresDisponivel, null);
  assert.equal(res2.jwtRpcGetDiagnostico, null);
  assertSemDadosSensiveis(res2);
});

test('10. Fail-closed fora da HML, sem escrita e unsubscribe garantido', async () => {
  const mockOff = criarClienteSimulado();
  const resOff = await diagnosticarVinculoNeonHml(SECRET_EMAIL, {
    cliente: mockOff.cliente,
    env: { VITE_NEON_HOMOLOGACAO_ENABLED: 'false' },
  });
  assert.equal(resOff.sessaoAutenticada, false);
  assert.equal(resOff.sessaoEstavelDuranteDiagnostico, false);
  assert.deepEqual(mockOff.rpcsChamadas, []);
  assert.deepEqual(mockOff.tabelasChamadas, []);
  assert.match(resOff.orientacao, /somente na homologação Neon/);
});
