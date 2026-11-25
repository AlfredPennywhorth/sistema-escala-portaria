import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const tela = readFileSync(new URL('../src/components/NeonAreaAuxiliarHml.tsx', import.meta.url), 'utf8');
const servico = readFileSync(new URL('../src/services/neon/areaAuxiliarReadService.ts', import.meta.url), 'utf8');

test('área da auxiliar é montada somente na branch/host explícitos de HML', () => {
  assert.match(app, /VITE_NEON_HOMOLOGACAO_ENABLED === 'true'/);
  assert.match(app, /hostnameHml &&\s*new URLSearchParams\(window.location.search\)\.get\('minhas-datas-neon'\) === '1'/);
  assert.match(app, /return <NeonAreaAuxiliarHml \/>/);
});

test('tela usa serviços Neon, sem chamadas de escrita ou fallback Supabase', () => {
  assert.match(tela, /obterMinhaAuxiliarNeon/);
  assert.match(tela, /listarMinhasDatasNeon/);
  assert.doesNotMatch(tela, /from ['"].*(?:supabaseClient|lib\/supabase|services\/supabase)/);
  assert.doesNotMatch(tela, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  assert.match(tela, /perfilFinal\.data\.auxiliar_id !== minha\.data\.id/);
  assert.match(tela, /item\.auxiliar_id !== minha\.data!\.id/);
});

test('serviço de datas restringe por auxiliar e filtra status publicado/travado', () => {
  assert.match(servico, /\.eq\('auxiliar_id', minha\.data\.id\)/);
  assert.match(servico, /\.in\('status', \['publicado', 'travado'\]\)/);
  assert.match(servico, /const limiteResultado = 100/);
});
