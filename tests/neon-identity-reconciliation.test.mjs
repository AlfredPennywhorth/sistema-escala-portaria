import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql=readFileSync(new URL('../migration/neon/tests/10_duplicate_identity_semantics_readonly.sql',import.meta.url),'utf8');
test('duplicate identity preflight remains one aggregate SELECT, with no writes',()=>{
  const statements=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n').trim();
  assert.match(statements,/^SELECT\s/);
  assert.equal((statements.match(/;/g)??[]).length,1);
  assert.doesNotMatch(statements,/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|REVOKE|GRANT|CREATE|DO|CALL|COPY|EXECUTE)\b/i);
  assert.match(statements,/HAVING COUNT\(\*\) > 1/);
  assert.match(statements,/COUNT\(DISTINCT perfil\)/);
  assert.match(statements,/COUNT\(DISTINCT auxiliar_id\)/);
  assert.match(statements,/grupos_com_conflito_perfil/);
  assert.match(statements,/grupos_com_conflito_auxiliar/);
  assert.doesNotMatch(statements,/SELECT\s+(?:\*|user_id|perfil|auxiliar_id)\s+FROM public\.usuarios_auxiliares/i);
});
