import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';

// Execute the actual TypeScript source, not a duplicate algorithm.
// Stub only the network dependencies; any accidental I/O fails the test.
const cache = new Map();
const requireNode = createRequire(import.meta.url);
function load(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  function localRequire(id) {
    if (!id.startsWith('.')) return requireNode(id);
    if (['./auxiliaresService','./restricoesService','./rodizioFunctionalHmlService','./authService'].includes(id)) {
      return new Proxy({}, { get() { return () => { throw new Error('Network forbidden in pure generation test'); }; } });
    }
    return load(resolve(dirname(path), id + '.ts'));
  }
  new Function('require','module','exports', js)(localRequire,module,module.exports);
  return module.exports;
}
const { gerarSugestaoRodizioNeon, converterSugestaoParaItensRpc } = load('src/services/neon/rodizioGeracaoNeonService.ts');
function fixture() {
  return {
    rodizio: { id:'r1', titulo:'Teste', data_inicio:'2026-11-22', data_fim:'2026-11-28', status:'rascunho', travado:false },
    auxiliares: Array.from({length:8},(_,i)=>({id:'a'+i,nome:'Auxiliar '+i,ativa:true})),
    restricoes: [], historicoTravado: []
  };
}
test('Neon: gera nos três dias e quatro portas originais',()=>{
  const r=gerarSugestaoRodizioNeon(fixture());
  assert.equal(r.itens.length,12);
  assert.deepEqual([...new Set(r.itens.map(i=>i.data))].sort(),['2026-11-22','2026-11-24','2026-11-28']);
  assert.deepEqual([...new Set(r.itens.map(i=>i.porta))].sort(),['Entrada','Galeria','Lateral','Sanitário'].sort());
  assert.equal(new Set(r.itens.map(i=>i.data+'|'+i.porta)).size,12);
});
test('Neon: respeita auxiliar inativa e indisponibilidade integral',()=>{
  const f=fixture();
  f.auxiliares[0].ativa=false;
  f.restricoes=[{id:'x',auxiliar_id:'a1',data:'2026-11-22',dia_semana:null,porta:null,tipo:'indisponivel',ativa:true}];
  const r=gerarSugestaoRodizioNeon(f);
  assert.ok(r.itens.every(i=>i.auxiliarId!=='a0'));
  assert.ok(r.itens.every(i=>i.data!=='2026-11-22'||i.auxiliarId!=='a1'));
});
test('Neon: histórico real aparece nas métricas',()=>{
  const f=fixture();
  f.historicoTravado=[{id:'h1',titulo:'Anterior',dataInicio:'2026-11-01',dataFim:'2026-11-07',itens:[{rodizioId:'h1',data:'2026-11-01',porta:'Entrada',auxiliarId:'a0'}]}];
  const r=gerarSugestaoRodizioNeon(f);
  assert.equal(r.metricas.find(m=>m.auxiliarId==='a0').totalHistorico,1);
});
test('Neon: impede geração em escala travada ou sem auxiliares ativas',()=>{
  const f=fixture();
  assert.throws(()=>gerarSugestaoRodizioNeon({...f,rodizio:{...f.rodizio,travado:true}}));
  assert.throws(()=>gerarSugestaoRodizioNeon({...f,auxiliares:[]}));
});
test('Neon: conversão preserva data, porta e identidade',()=>{
  const r=gerarSugestaoRodizioNeon(fixture());
  const itens=converterSugestaoParaItensRpc(r);
  assert.equal(itens.length,r.itens.length);
  for(let i=0;i<itens.length;i++) {
    assert.equal(itens[i].data,r.itens[i].data);
    assert.equal(itens[i].porta,r.itens[i].porta);
    assert.equal(itens[i].auxiliar_id,r.itens[i].auxiliarId);
  }
});
