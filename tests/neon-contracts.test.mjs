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
