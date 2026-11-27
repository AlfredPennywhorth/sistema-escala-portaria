import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const reqNode=createRequire(import.meta.url);
const rodizio={id:'r1',titulo:'Escala',data_inicio:'2026-11-22',data_fim:'2026-11-28',status:'rascunho',travado:false,revisao:7};
const item={data:'2026-11-22',porta:'Entrada',periodo:null,auxiliar_id:'a1',observacoes:null};
const next={...item,auxiliar_id:'a2'};
const Editor=()=>null, Gerador=()=>null, Relatorio=()=>null;
function mount(name, props={}, cadastro=[{id:'a1',nome:'Auxiliar Teste'}], env={VITE_NEON_SQL06_ENABLED:'false'}){
  const states=[],effects=[];let idx=0,started=false,prints=0;
  const hooks={useState(init){const i=idx++;if(!(i in states))states[i]=typeof init==='function'?init():init;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useEffect(fn){if(!started)effects.push(fn);}};
  const js=ts.transpileModule(readFileSync('src/components/'+name+'.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  function req(id){
    if(id==='react')return hooks;
    if(id.endsWith('rodizioFunctionalHmlService'))return {listarRodiziosAdministrativosNeonHml:async()=>({data:[rodizio],error:null}),obterRodizioComItensNeonHml:async()=>({data:{rodizio,itens:[item]},error:null})};
    if(id.endsWith('auxiliaresService'))return {listarAuxiliares:async()=>({data:cadastro,error:null})};
    if(id.endsWith('NeonRodizioEditor'))return {NeonRodizioEditor:Editor};
    if(id.endsWith('NeonRodizioGerador'))return {NeonRodizioGerador:Gerador};
    if(id.endsWith('NeonRelatorioRodizio'))return {NeonRelatorioRodizio:Relatorio};
    if(id==='/logo-ccb.png')return '/logo-ccb.png';
    return reqNode(id);
  }
  new Function('require','module','exports','window','viteEnv',js.replaceAll('import.meta.env','viteEnv'))(req,module,module.exports,{print(){prints++;}},Object.freeze(env));
  function render(){idx=0;return module.exports[name](props);}
  function walk(node,out=[]){if(Array.isArray(node)){for(const n of node)walk(n,out);}else if(node&&typeof node==='object'&&node.props){out.push(node);walk(node.props.children,out);}return out;}
  function nodes(){return walk(render());}
  function button(label){const n=nodes().find(n=>n.type==='button'&&(n.props.title===label||JSON.stringify(n.props.children).includes(label)));assert.ok(n,label);return n.props;}
  async function flush(){await new Promise(resolve=>setImmediate(resolve));}
  async function ready(){render();started=true;for(const fn of effects)fn();await flush();}
  return {ready,render,nodes,button,flush,prints:()=>prints};
}
test('real navigation preserves persisted baseline when applying generated items',async()=>{
  const m=mount('NeonRodiziosOperacional');await m.ready();
  await m.button('Visualizar detalhes').onClick();await m.flush();
  assert.equal(m.button('Gerar').disabled,false);
  m.button('Gerar').onClick();
  const g=m.nodes().find(n=>n.type===Gerador);assert.ok(g);
  g.props.onGerado([next]);
  const e=m.render();assert.equal(e.type,Editor);
  assert.deepEqual(e.props.itens,[item]);assert.deepEqual(e.props.sugestaoInicial,[next]);assert.equal(e.props.rodizio.revisao,7);
});
test('real navigation opens exclusive report and returns to details',async()=>{
  const m=mount('NeonRodiziosOperacional');await m.ready();
  await m.button('Visualizar detalhes').onClick();await m.flush();
  m.button('Relatório').onClick();
  const r=m.render();assert.equal(r.type,Relatorio);assert.equal(r.props.rodizioId,'r1');
  r.props.onFechar();assert.ok(m.button('Relatório'));
});
test('real report resolves names, civil dates and invokes print',async()=>{
  const m=mount('NeonRelatorioRodizio',{rodizioId:'r1',onFechar:()=>{}});await m.ready();
  const tree=JSON.stringify(m.render());assert.ok(tree.includes('Auxiliar Teste'));assert.ok(tree.includes('22/11/2026'));
  m.button('Imprimir').onClick();assert.equal(m.prints(),1);
});
test('real report refuses printing if referenced auxiliary is missing',async()=>{
  const m=mount('NeonRelatorioRodizio',{rodizioId:'r1',onFechar:()=>{}},[]);await m.ready();
  assert.ok(JSON.stringify(m.render()).includes('não foram localizadas'));
  assert.ok(!m.nodes().some(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Imprimir')));
  assert.equal(m.prints(),0);
});

test('canonical HML disables creation when versioned writes are not released',async()=>{
  const m=mount('NeonRodiziosOperacional');await m.ready();
  assert.equal(m.button('Novo Rascunho').disabled,true);
});
