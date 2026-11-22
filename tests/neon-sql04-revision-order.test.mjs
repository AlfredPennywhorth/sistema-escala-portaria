import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const proposed=read('migration/neon/13_sql04_revision_first_REVIEW_ONLY.sql');
const canonical=read('migration/neon/04_optimistic_revision_drafts_PROPOSAL.sql');
const functionDefinition=(source)=>{
 const start=source.toLowerCase().indexOf('create or replace function public.substituir_itens_rodizio_rascunho_versionado(');
 assert.ok(start>=0,'SQL04 function missing');
 const end=source.indexOf('$$;',start);
 assert.ok(end>start,'SQL04 function terminator missing');
 return source.slice(start,end+3);
};
test('SQL04 repair retains exact canonical function and changes no table structure/grants',()=>{
 assert.equal(functionDefinition(proposed),functionDefinition(canonical),'function drift from reviewed proposal');
 const body=proposed.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(body,/\b(?:ALTER TABLE|REVOKE|GRANT|DROP TABLE|TRUNCATE|DELETE FROM auth\.|INSERT INTO auth\.)\b/i);
 assert.match(body,/^\s*BEGIN\s*;/);
 assert.match(body,/\bCOMMIT\s*;/);
 assert.match(body,/LOCK TABLE public\.rodizios, public\.rodizio_itens IN ACCESS EXCLUSIVE MODE/);
 assert.match(body,/SET LOCAL lock_timeout/);
});
test('SQL04 revision check precedes state check under the same row lock and before DELETE',()=>{
 const fn=functionDefinition(proposed).toLowerCase();
 const lock=fn.indexOf('for update;');
 const revision=fn.indexOf('if v_revisao_atual is distinct from p_revisao_esperada');
 const state=fn.indexOf("if v_travado or v_status <> 'rascunho'");
 const deleting=fn.indexOf('delete from public.rodizio_itens');
 assert.ok(lock>=0&&lock<revision&&revision<state&&state<deleting,'OCC order or lock changed');
 assert.match(fn,/using errcode = 'p0001'/);
 assert.match(fn,/using errcode = '42501'/);
 assert.match(fn,/update public\.rodizios\s+set revisao = revisao \+ 1/);
});
test('repair is explicitly blocked by preflight and postflight checks',()=>{
 assert.match(proposed,/NAO EXECUTAR/);
 assert.match(proposed,/drenar transacoes/);
 for(const gate of ['DO $preflight$','DO $postflight$','current_database()', 'to_regprocedure',
     'search_path=""', 'p.prosecdef','Ordem SQL04 nao corrigida; rollback']){
   assert.ok(proposed.includes(gate),gate);
 }
 const pre=proposed.split('DO $preflight$')[1].split('$preflight$;')[0];
 const post=proposed.split('DO $postflight$')[1].split('$postflight$;')[0];
 assert.match(pre,/position\('if v_travado or v_status' IN lower\(v_source\)\)/);
 assert.match(post,/position\('if v_revisao_atual is distinct from p_revisao_esperada' IN lower\(v_source\)\)/);
 assert.match(pre,/\(p\.proconfig @> ARRAY\['search_path=""'\]::text\[\]\) IS TRUE/);
 assert.match(post,/\(p\.proconfig @> ARRAY\['search_path=""'\]::text\[\]\) IS TRUE/);
});
