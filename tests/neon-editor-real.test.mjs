import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Execute the real component with deterministic hook state and external service doubles.
// This is a component logic test, not a browser or React lifecycle test.
const requireNode = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync('src/components/NeonRodizioEditor.tsx','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const oldItem={data:'2026-11-22',porta:'Entrada',auxiliar_id:'a1',periodo:null,observacoes:null};
const newItem={...oldItem,auxiliar_id:'a2'};
const rodizio={id:'r1',titulo:'Escala',data_inicio:'2026-11-22',data_fim:'2026-11-28',observacoes:null,status:'rascunho',travado:false,revisao:7};
function mount(props, response={data:1,error:null,novaRevisao:8}){
  const states=[], refs=[], calls=[];
  let stateIndex=0, refIndex=0, effectDone=false, effects=[];
  const hooks={
    useState(init){const i=stateIndex++;if(!(i in states))states[i]=typeof init==='function'?init():init;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},
    useRef(init){const i=refIndex++;return refs[i]??=( {current:init} );},
    useEffect(fn){if(!effectDone)effects.push(fn);}
  };
  const rpc=new Proxy({}, {get(_,name){return async input=>{calls.push({name,input});return response;};}});
  const module={exports:{}};
  function req(id){
    if(id==='react')return hooks;
    if(id.includes('rodizioEditorNeonService'))return rpc;
    if(id.includes('auxiliaresService'))return {listarAuxiliares:async()=>({data:[{id:'a1',nome:'A',ativa:true},{id:'a2',nome:'B',ativa:true}],error:null})};
    if(id.includes('rodizioGeracaoNeonService'))return {PORTAS_GERACAO_NEON:[{id:'l1',nome:'Entrada'}]};
    if(id.includes('NeonRodizioGerador'))return {NeonRodizioGerador:()=>null};
    return requireNode(id);
  }
  new Function('require','module','exports',source)(req,module,module.exports);
  function render(){stateIndex=0;refIndex=0;return module.exports.NeonRodizioEditor({rodizio,itens:[oldItem],onFechar:()=>{},...props});}
  function walk(node,found=[]){if(Array.isArray(node)){for(const n of node)walk(n,found);}else if(node&&typeof node==='object'&&node.props){found.push(node);walk(node.props.children,found);}return found;}
  function button(label){const b=walk(render()).find(n=>n.type==='button'&&JSON.stringify(n.props.children).includes(label));assert.ok(b,'button '+label);return b.props;}
  async function ready(){render();effectDone=true;for(const fn of effects)fn();effects=[];await Promise.resolve();}
  function field(label){const n=walk(render()).find(n=>n.props['aria-label']===label);assert.ok(n,label);return n.props;}
  return {ready,button,calls,field};
}
test('suggestion does not replace persisted baseline; publishing stays blocked',async()=>{
  const m=mount({sugestaoInicial:[newItem]});await m.ready();
  assert.equal(m.button('P0.4').disabled,true);
  assert.equal(m.button('P0.3').disabled,false);
  await m.button('P0.3').onClick();
  assert.equal(m.calls.length,1);
  assert.equal(m.calls[0].name,'substituirItensNeonEditor');
  assert.equal(m.calls[0].input.revisaoOriginal,7);
  assert.deepEqual(m.calls[0].input.itens,[newItem]);
  assert.equal(m.button('P0.4').disabled,true);
});
test('locked record cannot save or publish',async()=>{
  const m=mount({rodizio:{...rodizio,status:'travado',travado:true}});await m.ready();
  assert.equal(m.button('P0.3').disabled,true);
  assert.equal(m.button('P0.4').disabled,true);
  assert.equal(m.button('P0.2').disabled,true);
});
test('uncertain response blocks subsequent save using original revision',async()=>{
  const m=mount({sugestaoInicial:[newItem]},{data:null,error:null});await m.ready();
  const save=m.button('P0.3').onClick;
  await save();await save();
  assert.equal(m.calls.length,1);
  assert.equal(m.button('P0.3').disabled,true);
});

test('manual editing sends actual field values through versioned adapter',async()=>{
  const m=mount({});await m.ready();
  m.field('Data do item').onChange({target:{value:'2026-11-24'}});
  m.field('Auxiliar do item').onChange({target:{value:'a2'}});
  m.field('Período do item').onChange({target:{value:'Noite'}});
  m.field('Observações do item').onChange({target:{value:'Teste manual'}});
  assert.equal(m.button('P0.4').disabled,true);
  await m.button('P0.3').onClick();
  assert.deepEqual(m.calls,[{name:'substituirItensNeonEditor',input:{rodizioId:'r1',revisaoOriginal:7,itens:[{...oldItem,data:'2026-11-24',auxiliar_id:'a2',periodo:'Noite',observacoes:'Teste manual'}]}}]);
});
test('manual editing rejects date outside persisted period without RPC',async()=>{
  const m=mount({});await m.ready();
  m.field('Data do item').onChange({target:{value:'2026-12-01'}});
  await m.button('P0.3').onClick();
  assert.equal(m.calls.length,0);
});
test('manual edit handler cannot modify a locked record even when invoked directly',async()=>{
  const m=mount({rodizio:{...rodizio,status:'travado',travado:true}});await m.ready();
  m.field('Auxiliar do item').onChange({target:{value:'a2'}});
  assert.equal(m.field('Auxiliar do item').value,'a1');
  await m.button('P0.3').onClick();
  assert.equal(m.calls.length,0);
});
