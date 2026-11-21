import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const draft = read('migration/neon/04_optimistic_revision_drafts_PROPOSAL.sql');
const transitions = read('migration/neon/05_versioned_publish_lock_PROPOSAL.sql');
const draftClient = read('src/services/neon/rodizioDraftVersionedWriteService.ts');
const statusClient = read('src/services/neon/rodizioStatusVersionedHmlService.ts');

test('SQL04: autorização admin e OCC sob row lock antes de qualquer DELETE', () => {
  assert.match(draft, /usuario_tem_perfil\('admin'\)/i);
  assert.match(draft, /security invoker/i);
  assert.match(draft, /for update\s*;/i);
  assert.match(draft, /v_revisao_atual is distinct from p_revisao_esperada/i);
  assert.match(draft, /using errcode = 'P0001'/i);
  assert.ok(draft.indexOf('v_revisao_atual is distinct from p_revisao_esperada') <
    draft.indexOf('delete from public.rodizio_itens'));
  assert.match(draft, /set revisao = revisao \+ 1/i);
  assert.match(draft, /REVOKE ALL ON FUNCTION public\.substituir_itens_rodizio_rascunho_versionado/i);
});

test('SQL05: publish and lock require admin, lock, version, and at least one item', () => {
  for (const name of ['publicar_rodizio_versionado', 'travar_rodizio_versionado']) {
    const start = transitions.indexOf('CREATE OR REPLACE FUNCTION public.' + name);
    assert.ok(start >= 0, name + ' missing');
    const next = transitions.indexOf('CREATE OR REPLACE FUNCTION', start + 1);
    const block = transitions.slice(start, next < 0 ? undefined : next);
    assert.match(block, /SECURITY INVOKER/i);
    assert.match(block, /usuario_tem_perfil\('admin'\)/i);
    assert.match(block, /FOR UPDATE\s*;/i);
    assert.match(block, /v_revisao IS DISTINCT FROM p_revisao_esperada/i);
    assert.match(block, /IF NOT EXISTS\s*\(\s*SELECT 1 FROM public\.rodizio_itens/i);
    assert.match(block, /revisao = revisao \+ 1/i);
    assert.match(transitions, new RegExp('REVOKE ALL ON FUNCTION public\\.' + name));
  }
});

test('Neon adapters require original revision and disallow blind retry', () => {
  assert.match(draftClient, /Number\.isSafeInteger\(revisaoEsperada\)/);
  assert.match(draftClient, /p_revisao_esperada: revisaoEsperada/);
  assert.match(draftClient, /Resposta indeterminada da RPC/);
  assert.match(statusClient, /Number\.isSafeInteger\(revisaoOriginal\)/);
  assert.match(statusClient, /p_revisao_esperada: revisaoOriginal/);
  assert.match(statusClient, /Falha de transporte com resultado indeterminado/);
});

test('HML-only guards remain enforced on mutation adapters', () => {
  for (const source of [draftClient, statusClient]) {
    assert.match(source, /VITE_NEON_HOMOLOGACAO_ENABLED\s*!==\s*'true'/);
    assert.match(source, /vinculo\.data\?\.perfil !== 'admin'|perfil\.data\?\.perfil !== 'admin'/);
  }
});

test('Neon legacy scale service fails closed for every write route', () => {
  const legacy = read('src/services/neon/rodiziosService.ts');
  assert.match(legacy, /const ESCRITA_BLOQUEADA/);
  const methods = ['criarRodizio', 'salvarItensRodizio', 'publicarRodizio',
    'travarRodizio', 'cancelarRodizio', 'excluirRodizioRascunho'];
  for (const method of methods) {
    const start = legacy.indexOf('export async function ' + method + '(');
    assert.ok(start >= 0, method + ' missing');
    const next = legacy.indexOf('export async function ', start + 1);
    const body = legacy.slice(start, next < 0 ? undefined : next);
    assert.match(body, /return \{ data: null, error: ESCRITA_BLOQUEADA \}/,
      method + ' must fail closed');
    assert.doesNotMatch(body, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/,
      method + ' must not write directly');
  }
});

test('Neon restriction period queries honor both bounds and weekday recurrences', () => {
  const source = read('src/services/neon/restricoesService.ts');
  for (const name of ['listarRestricoesPorAuxiliarEPeriodo', 'listarRestricoesPorPeriodo']) {
    const start = source.indexOf('export async function ' + name + '(');
    assert.ok(start >= 0, name + ' missing');
    const next = source.indexOf('export async function ', start + 1);
    const block = source.slice(start, next < 0 ? undefined : next);
    assert.match(block, /dataFim: string/);
    assert.match(block, /and\(data\.gte\.\$\{dataInicio\},data\.lte\.\$\{dataFim\}\)/);
    assert.match(block, /and\(data\.is\.null,dia_semana\.not\.is\.null\)/);
  }
});

test('No direct scale DML in Neon service modules', () => {
  // Conservative fail-closed check: anything writing a scale table from a
  // Neon service must use an approved RPC instead of ad-hoc REST mutations.
  const dir = new URL('../src/services/neon/', import.meta.url);
  for (const filename of readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(new URL(filename, dir), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // A chain beginning at .from('rodizios') or .from('rodizio_itens')
    // must not contain direct insert/update/delete/upsert before its
    // terminal semicolon. This deliberately prefers false positives over
    // silently approving dangerous new DML.
    const chains = source.split(';').filter((segment) =>
      /\.from\(['"]rodizios?['"]\)|\.from\(['"]rodizio_itens['"]\)/.test(segment));
    for (const chain of chains) {
      assert.doesNotMatch(chain, /\.(?:insert|update|delete|upsert)\s*\(/,
        filename + ': prohibited direct scale mutation');
    }
  }
});

test('SQL06 proposed admin RPCs enforce JWT, lock, revision and conservative status', () => {
  const source = read('migration/neon/06_remaining_admin_mutations_PROPOSAL.sql');
  const methods = [
    'criar_rodizio_rascunho_versionado',
    'atualizar_cabecalho_rascunho_versionado',
    'cancelar_rodizio_versionado',
    'excluir_rodizio_rascunho_versionado',
  ];
  for (const method of methods) {
    const start = source.indexOf('CREATE OR REPLACE FUNCTION public.' + method);
    assert.ok(start >= 0, method + ' missing');
    const next = source.indexOf('CREATE OR REPLACE FUNCTION', start + 1);
    const body = source.slice(start, next < 0 ? undefined : next);
    assert.match(body, /SECURITY INVOKER/i);
    assert.match(body, /usuario_atual_id\(\)/);
    assert.match(body, /usuario_tem_perfil\('admin'\)/);
    assert.match(source, new RegExp('REVOKE ALL ON FUNCTION public\\.' + method));
  }
  for (const method of methods.slice(1)) {
    const start = source.indexOf('CREATE OR REPLACE FUNCTION public.' + method);
    const next = source.indexOf('CREATE OR REPLACE FUNCTION', start + 1);
    const body = source.slice(start, next < 0 ? undefined : next);
    assert.match(body, /FOR UPDATE/);
    assert.match(body, /v_revisao IS DISTINCT FROM p_revisao_esperada/);
    assert.match(body, /ERRCODE = 'P0001'/);
  }
  assert.match(source, /p_data_inicio > p_data_fim/);
  assert.match(source, /data < p_data_inicio OR data > p_data_fim/);
});

test('SQL06 HML adapters require Admin JWT, OCC and no fallback DML', () => {
  const source = read('src/services/neon/rodizioAdminSql06HmlService.ts');
  assert.match(source, /VITE_NEON_HOMOLOGACAO_ENABLED\s*!==\s*'true'/);
  assert.match(source, /perfil\.data\?\.perfil !== 'admin'/);
  assert.match(source, /p_revisao_esperada: revisaoOriginal/);
  assert.match(source, /Conflito de revisão/);
  assert.match(source, /Resultado indeterminado/);
  assert.match(source, /Criação NÃO é idempotente/);
  for (const method of [
    'criar_rodizio_rascunho_versionado',
    'atualizar_cabecalho_rascunho_versionado',
    'cancelar_rodizio_versionado',
    'excluir_rodizio_rascunho_versionado',
  ]) {
    assert.match(source, new RegExp("'"+method+"'"));
  }
  assert.doesNotMatch(source, /\.(?:insert|update|delete|upsert)\s*\(/);
});

test('SQL06 mutation adapter is bound to the disposable Neon branch only', () => {
  const source = read('src/services/neon/rodizioAdminSql06HmlService.ts');
  assert.match(source, /VITE_NEON_SQL06_ENABLED\s*!==\s*'true'/);
  assert.match(source, /VITE_NEON_AUTH_URL\s*!==\s*authEndpoint/);
  assert.match(source, /VITE_NEON_DATA_API_URL\s*!==\s*dataEndpoint/);
  assert.match(source, /ep-nameless-dust-b6271958\.neonauth/);
  assert.match(source, /ep-nameless-dust-b6271958\.apirest/);
  const build = read('scripts/build-cloudflare-homologacao.mjs');
  assert.doesNotMatch(build, /VITE_NEON_SQL06_ENABLED:\s*'true'/);
});

test('SQL06 date validation rejects invalid ISO dates and year coercion', () => {
  const source = read('src/services/neon/rodizioAdminSql06HmlService.ts');
  assert.match(source, /ano < 1 \|\| ano > 9999/);
  assert.match(source, /dt\.setUTCFullYear\(ano, mes - 1, dia\)/);
  assert.doesNotMatch(source, /Date\.UTC\(ano, mes - 1, dia\)/);
});

test('SQL06 malformed external payload must be rejected before RPC', () => {
  const source = read('src/services/neon/rodizioAdminSql06HmlService.ts');
  assert.match(source, /input !== null && typeof input === 'object'/);
  assert.match(source, /typeof input\.titulo === 'string'/);
  assert.match(source, /intervaloValido\(input\.dataInicio, input\.dataFim\)/);
});

test('SQL06 preflight must remain strictly read-only', () => {
  const source = read('migration/neon/tests/07_sql06_preflight_readonly.sql')
    .replace(/--.*$/gm, '');
  assert.match(source, /to_regprocedure/);
  assert.match(source, /SELECT current_database\(\)/i);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|REVOKE|GRANT|TRUNCATE)\b/i);
});

test('SQL06 UI preflight does not invoke mutations and preserves SQL05 fixtures', () => {
  const source = read('src/components/NeonRpcBranchHomologacao.tsx');
  const start = source.indexOf('async function preflightSql06SomenteLeitura()');
  const end = source.indexOf('async function executarProva(', start);
  assert.ok(start > 0 && end > start, 'preflight should be independent');
  const block = source.slice(start, end);
  assert.match(block, /const sessao = await perfilAtual\(\)/);
  assert.match(block, /\.from\('rodizios'\)/);
  assert.match(block, /\.from\('rodizio_itens'\)/);
  assert.doesNotMatch(block, /\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  for (const id of ['000000000206', '000000000207', '000000000208']) {
    assert.match(block, new RegExp(id));
  }
  assert.match(source, /SQL 06 — conferir fixtures \(somente leitura\)/);
});

test('SQL05 one-time positive actions are unreachable after fixture 206 consumed', () => {
  const source = read('src/components/NeonRpcBranchHomologacao.tsx');
  assert.match(source, /operacao === 'publicar' \|\| operacao === 'travar'/);
  assert.match(source, /T01\/T04 encerrados: fixture 206 já travada/);
  assert.doesNotMatch(source, /onClick=\{\(\) => void executar\(\(\) => executarTransicaoVersionada\('publicar'\)\)\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => void executar\(\(\) => executarTransicaoVersionada\('travar'\)\)\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => void executar\(\(\) => executarProva\(false\)\)\}/);
  assert.match(source, /Teste positivo legado da fixture 205 já consumido/);
});

test('SQL06 non-Admin probes require JWT and stop after unexpected results', () => {
  const source = read('src/components/NeonRpcBranchHomologacao.tsx');
  const start = source.indexOf('async function testarNegativaSql06(');
  const end = source.indexOf('async function preflightSql06SomenteLeitura()', start);
  assert.ok(start > 0 && end > start);
  const section = source.slice(start, end);
  assert.match(section, /const sessao = await perfilAtual\(\)/);
  assert.match(section, /if \(sessao\.perfil === 'admin'\)/);
  assert.match(section, /if \(!negacaoPorAdmin\) setNegativasSql06Interrompidas\(true\)/);
  assert.match(section, /codigo === '42501'/);
  assert.match(section, /Somente administrador autenticado/);
  for (const name of [
    'criar_rodizio_rascunho_versionado',
    'atualizar_cabecalho_rascunho_versionado',
    'cancelar_rodizio_versionado',
    'excluir_rodizio_rascunho_versionado',
  ]) assert.match(section, new RegExp(name));
  assert.match(source, /disabled=\{ocupado \|\| negativasSql06Interrompidas\}/);
});

test('SQL06 Admin P02 is isolated, validates original fixture and blocks replay', () => {
  const source = read('src/components/NeonRpcBranchHomologacao.tsx');
  const start = source.indexOf('async function testarPositivaSql06P02()');
  const end = source.indexOf('async function preflightSql06SomenteLeitura()', start);
  assert.ok(start > 0 && end > start);
  const code = source.slice(start, end);
  assert.match(code, /sessao\.perfil !== 'admin'/);
  assert.match(code, /000000000209/);
  assert.match(code, /000000000309/);
  assert.match(code, /String\(anterior\.data\.revisao\) !== '0'/);
  assert.match(code, /anterior\.data\.status !== 'rascunho'/);
  assert.match(code, /setPositivaSql06Tentada\(true\)/);
  assert.ok(code.indexOf('setPositivaSql06Tentada(true)') <
    code.indexOf("CLIENTE.rpc('atualizar_cabecalho_rascunho_versionado'"));
  assert.match(code, /p_revisao_esperada: 0/);
  assert.match(code, /String\(posterior\.data\?\.revisao\) === '1'/);
  assert.match(code, /P02 inconclusivo ou falhou; NÃO REPETIR/);
  assert.doesNotMatch(code, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  assert.doesNotMatch(source, /onClick=\{\(\) => void executar\(testarPositivaSql06P02\)\}/);
  assert.match(source, /P02 — Edição da fixture 209: concluída, revisão 1/);
  assert.match(source, /P01 — Criar rascunho: bloqueado/);
  assert.match(source, /P05 — Cancelar fixture 210 uma única vez \(Admin\)/);
  assert.match(source, /P07 — Excluir fixture 211: bloqueado/);
  for (const method of [
    'criar_rodizio_rascunho_versionado',
    'cancelar_rodizio_versionado',
    'excluir_rodizio_rascunho_versionado',
  ]) assert.doesNotMatch(code, new RegExp("CLIENTE\\.rpc\\('"+method+"'"));
});

test('SQL06 P05 Admin cancelamento isolado, OCC e sem repetição', () => {
  const source = read('src/components/NeonRpcBranchHomologacao.tsx');
  const start = source.indexOf('async function testarPositivaSql06P05()');
  const end = source.indexOf('async function preflightSql06SomenteLeitura()', start);
  assert.ok(start > 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /sessao\.perfil !== 'admin'/);
  assert.match(block, /000000000210/);
  assert.match(block, /000000000310/);
  assert.match(block, /anterior\.data\.status !== 'publicado'/);
  assert.match(block, /anterior\.data\.travado !== false/);
  assert.match(block, /String\(anterior\.data\.revisao\) !== '0'/);
  assert.match(block, /setP05Tentado\(true\)/);
  assert.ok(block.indexOf('setP05Tentado(true)') <
    block.indexOf("CLIENTE.rpc('cancelar_rodizio_versionado'"));
  assert.match(block, /p_revisao_esperada: 0/);
  assert.match(block, /posterior\.data\?\.status === 'cancelado'/);
  assert.match(block, /String\(posterior\.data\?\.revisao\) === '1'/);
  assert.match(block, /itensPosteriores\.data\?\.length === 1/);
  assert.match(block, /P05 inconclusivo ou falhou; NÃO REPETIR/);
  assert.doesNotMatch(block, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  assert.match(source, /disabled=\{ocupado \|\| p05Tentado\}/);
  assert.match(source, /P01 — Criar rascunho: bloqueado/);
  assert.match(source, /P07 — Excluir fixture 211: bloqueado/);
});
