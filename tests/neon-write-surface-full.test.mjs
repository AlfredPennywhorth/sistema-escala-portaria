import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../migration/neon/tests/11_write_surface_full_gate_readonly.sql',import.meta.url),'utf8'
);
test('full write surface audit is one readonly query with no PII',()=>{
  const body=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n').trim();
  assert.match(body,/^WITH\s+expected_rpc\s*\(/i);
  assert.equal((body.match(/;/g)||[]).length,1);
  assert.doesNotMatch(body,/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+|TRUNCATE\s+|REVOKE\s+|GRANT\s+|CREATE\s+|DO\s+\$|CALL\s+|COPY\s+|EXECUTE\s+)\b/i);
  assert.doesNotMatch(body,/\b(auth\.users|email|telefone|senha|token|cpf)\b/i);
  for (const needle of ['tables_with_direct_dml','legacy_rpc_auth_executable',
    'versioned_rpc_missing_or_overloaded','versioned_rpc_not_all_definer',
    'versioned_rpc_exposed_to_anonymous','direct_dml_closed',
    'legacy_authenticated_closed']) assert.ok(body.includes(needle),needle);
});
test('all seven approved versioned admin writes are in audit',()=>{
  const funcs=['criar_rodizio_rascunho_versionado',
    'atualizar_cabecalho_rascunho_versionado',
    'substituir_itens_rodizio_rascunho_versionado',
    'publicar_rodizio_versionado','travar_rodizio_versionado',
    'cancelar_rodizio_versionado','excluir_rodizio_rascunho_versionado'];
  for (const fn of funcs) assert.ok(sql.includes("'"+fn+"'"),fn);
});
