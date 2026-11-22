import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql=readFileSync(new URL('../migration/neon/12_atomic_write_surface_hardening_REVIEW_ONLY.sql',import.meta.url),'utf8');
const uncommented=sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
const functions=[
'criar_rodizio_rascunho_versionado',
'atualizar_cabecalho_rascunho_versionado',
'substituir_itens_rodizio_rascunho_versionado',
'publicar_rodizio_versionado',
'travar_rodizio_versionado',
'cancelar_rodizio_versionado',
'excluir_rodizio_rascunho_versionado'
];
test('dangerous SQL is clearly review-only and guarded by transaction and lock',()=>{
 assert.match(sql,/NAO EXECUTAR AUTOMATICAMENTE/);
 assert.match(sql,/drenar transacoes/i);
 assert.match(uncommented,/\bBEGIN\s*;/);
 assert.match(uncommented,/\bCOMMIT\s*;/);
 assert.match(uncommented,/SET LOCAL lock_timeout/);
 assert.match(uncommented,/LOCK TABLE public\.rodizios, public\.rodizio_itens/);
 assert.match(uncommented,/IF current_database\(\) <> 'rodizio_portas'/);
 assert.match(uncommented,/SQL04 deve validar revisao ANTES do estado/);
 assert.match(uncommented,/RAISE EXCEPTION 'DML direto ainda acessivel, rollback'/);
 assert.match(uncommented,/RAISE EXCEPTION 'RPC antiga ainda executavel, rollback'/);
 assert.doesNotMatch(uncommented,/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+TABLE)\b/i);
});
test('all seven versioned RPCs are converted and guarded, legacy RPC disabled',()=>{
 for(const fn of functions){
   assert.match(uncommented,new RegExp('ALTER FUNCTION public\\.'+fn+'\\([^;]+\\) SECURITY DEFINER;'));
 }
 assert.equal((uncommented.match(/ALTER FUNCTION public\./g)||[]).length,7);
 assert.match(uncommented,/REVOKE INSERT,UPDATE,DELETE ON TABLE public\.rodizios,public\.rodizio_itens/);
 assert.match(uncommented,/REVOKE EXECUTE ON FUNCTION public\.substituir_itens_rodizio_rascunho\(uuid,jsonb\)/);
 assert.match(uncommented,/FROM PUBLIC, anonymous, authenticated/);
 assert.match(uncommented,/TO authenticated/);
});

test('postflight rejects residual inherited or column-level write privileges for both roles',()=>{
 const postflight=uncommented.split('DO $postflight$')[1];
 assert.ok(postflight,'postflight required');
 for(const role of ['authenticated','anonymous']){
   for(const op of ['INSERT','UPDATE']){
     assert.match(postflight,new RegExp("has_any_column_privilege\\('"+role+"',c\\.oid,'"+op+"'\\)"),role+' '+op);
   }
   for(const op of ['INSERT','UPDATE','DELETE']){
     assert.match(postflight,new RegExp("has_table_privilege\\('"+role+"',c\\.oid,'"+op+"'\\)"),role+' table '+op);
   }
 }
 assert.match(postflight,/IF v_n <> 0 THEN\s*RAISE EXCEPTION 'DML direto ainda acessivel, rollback'/);
});
test('missing proconfig must fail closed before and after SECURITY DEFINER',()=>{
 const nullSafe=/\(p\.proconfig @> ARRAY\['search_path=""'\]::text\[\]\) IS NOT TRUE/g;
 assert.equal((uncommented.match(nullSafe)||[]).length,2,'both preflight and postflight must reject NULL proconfig');
 assert.doesNotMatch(uncommented,/OR NOT \(p\.proconfig @>/,'NULL bypass via NOT must not reappear');
});
