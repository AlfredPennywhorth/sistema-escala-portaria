import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../migration/neon/tests/09_schema_compat_preflight_readonly.sql', import.meta.url), 'utf8');
test('schema preflight is one read-only SELECT with aggregated results only', () => {
  const raw = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.match(raw.trim(), /^SELECT\s/i);
  assert.equal((raw.match(/;/g) ?? []).length, 1);
  assert.doesNotMatch(raw, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|REVOKE|GRANT|CREATE|DO|CALL|COPY|EXECUTE)\b/i);
  for (const field of ['identidades_com_vinculos_duplicados', 'vinculos_excedentes',
    'user_id_unico_por_constraint', 'indice_restricoes_ativas_presente',
    'itens_historicos_fora_intervalo', 'gatilhos_insert_itens']) {
    assert.match(raw, new RegExp(field));
  }
  assert.doesNotMatch(raw, /\b(email|telefone|nome|senha|token|cpf|endereco)\b\s*[,=]/i);
});
