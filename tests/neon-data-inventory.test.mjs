import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../migration/neon/tests/08_source_destination_inventory_readonly.sql', import.meta.url),
  'utf8',
);

test('shared source/destination inventory is strictly readonly', () => {
  const withoutComments = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.match(withoutComments, /^SELECT current_database\(\)/);
  assert.equal((withoutComments.match(/;/g) ?? []).length, 1);
  assert.doesNotMatch(withoutComments, /\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COPY|EXECUTE|CALL|DO)\b/i);
  assert.doesNotMatch(withoutComments, /\bauth\.(users|identities|sessions)\b/i);
});

test('inventory covers required five business tables and referential invariants', () => {
  for (const table of [
    'auxiliares', 'restricoes_auxiliares', 'rodizios',
    'rodizio_itens', 'usuarios_auxiliares',
  ]) assert.match(sql, new RegExp('public\\.' + table + '\\b'));
  for (const invariant of [
    'rodizios_intervalo_invertido', 'itens_sem_rodizio',
    'itens_auxiliar_inexistente', 'restricoes_auxiliar_inexistente',
    'itens_fora_periodo', 'rodizios_travados_sem_flag',
  ]) assert.match(sql, new RegExp(invariant));
  assert.doesNotMatch(sql, /\b(email|telefone|nome|senha|token|cpf|endereco)\b\s*[,=]/i);
});
