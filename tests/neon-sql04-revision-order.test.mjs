import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const proposed = read('migration/neon/13_sql04_revision_first_REVIEW_ONLY.sql');
const canonical = read('migration/neon/04_optimistic_revision_drafts_PROPOSAL.sql');
const installedBaseline = read('migration/neon/tests/fixtures/sql04_installed_state_first_baseline.sql.txt');
const md5 = (body) => createHash('md5').update(body, 'utf8').digest('hex');

function functionDefinition(source) {
 const start = source.toLowerCase().indexOf('create or replace function public.substituir_itens_rodizio_rascunho_versionado(');
 assert.ok(start >= 0, 'SQL04 function missing');
 const end = source.indexOf('$$;', start);
 assert.ok(end > start, 'SQL04 function terminator missing');
 return source.slice(start, end + 3);
}
function functionBody(source) {
 const fn = functionDefinition(source);
 const start = fn.indexOf('as $$');
 assert.ok(start >= 0, 'SQL04 function dollar quote missing');
 return fn.slice(start + 'as $$'.length, fn.lastIndexOf('$$;'));
}

test('SQL04 repair retains exact canonical function without grants or table structure changes', () => {
 assert.equal(functionDefinition(proposed), functionDefinition(canonical), 'function drift from canonical SQL04');
 const body = proposed.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(body, /\b(?:ALTER TABLE|REVOKE|GRANT|DROP TABLE|TRUNCATE|DELETE FROM auth\.|INSERT INTO auth\.)\b/i);
 assert.match(body, /^\s*BEGIN\s*;/);
 assert.match(body, /\bCOMMIT\s*;/);
 assert.match(body, /LOCK TABLE public\.rodizios, public\.rodizio_itens IN ACCESS EXCLUSIVE MODE/);
 assert.match(body, /SET LOCAL lock_timeout/);
});

test('SQL04 revision check precedes state under same row lock and before item DELETE', () => {
 const fn = functionDefinition(proposed).toLowerCase();
 const lock = fn.indexOf('for update;');
 const revision = fn.indexOf('if v_revisao_atual is distinct from p_revisao_esperada');
 const state = fn.indexOf("if v_travado or v_status <> 'rascunho'");
 const deleting = fn.indexOf('delete from public.rodizio_itens');
 assert.ok(lock >= 0 && lock < revision && revision < state && state < deleting, 'OCC order or lock changed');
 assert.match(fn, /using errcode = 'p0001'/);
 assert.match(fn, /using errcode = '42501'/);
 assert.match(fn, /update public\.rodizios\s+set revisao = revisao \+ 1/);
});

test('maintenance and fail-closed pre/postflight are documented and implemented', () => {
 assert.match(proposed, /NAO EXECUTAR/);
 assert.match(proposed, /(?:drenagem|drenar) de transacoes/);
 for (const gate of ['DO $preflight$', 'DO $postflight$', 'current_database()', 'to_regprocedure',
   'search_path=""', 'p.prosecdef', 'Corpo SQL04 revision-first inesperado; rollback']) {
   assert.ok(proposed.includes(gate), gate);
 }
 const pre = proposed.split('DO $preflight$')[1].split('$preflight$;')[0];
 const post = proposed.split('DO $postflight$')[1].split('$postflight$;')[0];
 assert.match(pre, /md5\(p\.prosrc\)/);
 assert.match(post, /md5\(p\.prosrc\)/);
 assert.match(pre, /\(p\.proconfig @> ARRAY\['search_path=""'\]::text\[\]\) IS TRUE/);
 assert.match(post, /\(p\.proconfig @> ARRAY\['search_path=""'\]::text\[\]\) IS TRUE/);
});

test('installed state-first body must equal complete reviewed baseline, not only two substrings', () => {
 const hash = md5(installedBaseline);
 assert.equal(hash, 'b06899977f63be59f8c993b05d134498');
 assert.ok(proposed.includes("md5(p.prosrc) = '" + hash + "'"));
 const state = installedBaseline.indexOf("if v_travado or v_status <> 'rascunho'");
 const revision = installedBaseline.indexOf('if v_revisao_atual is distinct from p_revisao_esperada');
 assert.ok(state >= 0 && state < revision);
 // Extra validation with BOTH substrings intact must never pass baseline.
 const modified = installedBaseline.replace('if v_total < 1 or v_total > 500 then',
    'if v_total < 1 or v_total > 499 then');
 assert.notEqual(modified, installedBaseline);
 assert.ok(modified.includes("if v_travado or v_status <> 'rascunho'"));
 assert.ok(modified.includes('if v_revisao_atual is distinct from p_revisao_esperada'));
 assert.notEqual(md5(modified), hash);
 assert.notEqual(md5(installedBaseline + '\n'), hash, 'whitespace drift must be rejected');
});

test('postflight hashes the complete canonical revision-first function body', () => {
 const target = md5(functionBody(canonical));
 assert.equal(target, 'f2100180626d8fd8881aebb99ca57d0d');
 assert.equal(md5(functionBody(proposed)), target);
 assert.ok(proposed.includes("md5(p.prosrc) = '" + target + "'"));
 assert.notEqual(md5(functionBody(proposed).replace('v_total > 500', 'v_total > 499')), target);
});
