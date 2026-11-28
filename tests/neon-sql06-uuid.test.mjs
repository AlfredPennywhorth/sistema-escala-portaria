import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../src/services/neon/rodizioAdminSql06HmlService.ts', import.meta.url), 'utf8');
const declaration = code.match(/^const UUID = \/(.+)\/i;$/m);
assert.ok(declaration, 'A expressão UUID do adaptador SQL06 deve ser localizada');
const UUID = new RegExp(declaration[1], 'i');

test('SQL06 valida identificadores UUID completos em todas as quatro mutações', () => {
  assert.equal(UUID.test('00000000-0000-4000-8000-000000000202'), true);
  assert.equal(UUID.test('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(UUID.test('550E8400-E29B-41D4-A716-446655440000'), true);
});

test('SQL06 rejeita identificadores truncados, malformados e texto excedente', () => {
  for (const id of [
    '550e8400-e29b-41d4-446655440000', // regressão: grupo de quatro faltante
    '550e8400-e29b-41d4-a716',
    '550e8400-e29b-41d4-a716-44665544000',
    '550e8400-e29b-41d4-a716-446655440000xyz',
    ' 550e8400-e29b-41d4-a716-446655440000',
    '',
  ]) {
    assert.equal(UUID.test(id), false, 'Deveria rejeitar ' + JSON.stringify(id));
  }
});

test('SQL06 conserva bloqueio de branch descartável e concorrência versionada', () => {
  assert.match(code, /VITE_NEON_SQL06_ENABLED\s*!==\s*'true'/);
  assert.match(code, /VITE_NEON_AUTH_URL\s*!==\s*authEndpoint/);
  assert.match(code, /VITE_NEON_DATA_API_URL\s*!==\s*dataEndpoint/);
  assert.match(code, /p_revisao_esperada: revisaoOriginal/);
  assert.doesNotMatch(code, /\.(?:insert|update|delete|upsert)\s*\(/);
});
