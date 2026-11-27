import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

// Never instantiate a client from a deployed origin or a configurable target.
const local = location.origin === 'http://localhost:5173' && import.meta.env.DEV;
const authUrl = 'https://ep-sparkling-frog-b6k2wvw7.neonauth.c-2.sa-east-1.aws.neon.tech/rodizio_portas/auth';
const dataUrl = 'https://ep-sparkling-frog-b6k2wvw7.apirest.c-2.sa-east-1.aws.neon.tech/rodizio_portas/rest/v1';
const client = local ? createClient({ auth: { url: authUrl, adapter: SupabaseAuthAdapter(), allowAnonymous: false }, dataApi: { url: dataUrl } }) : null;
const id = (n: number) => '00000000-0000-4000-8000-000000000' + n;
const draft = { id: id(205), titulo: 'TESTE FICTICIO RPC JWT BRANCH TEMPORARIA', status: 'rascunho', travado: false, revisao: 0, count: 1 };
const locked = { id: id(206), titulo: 'TESTE FICTICIO TRANSICAO OCC COM ITEM', status: 'travado', travado: true, revisao: 2, count: 1 };
const published = { id: id(203), titulo: 'TESTE FICTICIO PUBLICADO', status: 'publicado', travado: false, revisao: 0, count: 3 };
type Fixture = typeof draft;
type Scenario = 'stale' | 'locked' | 'published' | 'invalid-fk' | 'valid';
function App() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [result, setResult] = useState('Nenhum teste executado.');
  const [busy, setBusy] = useState(false);
  const [halted, setHalted] = useState(false);
  const running = useRef(false);
  const attempted = useRef(new Set<Scenario>());
  async function run(action: () => Promise<void>) {
    if (running.current || !client || halted) return;
    running.current = true; setBusy(true);
    try { await action(); } catch { setHalted(true); setResult('Interrompido: falha ou resultado indeterminado. Conferir banco antes de repetir.'); }
    finally { running.current = false; setBusy(false); }
  }
  async function identity() {
    if (!client) throw Error('disabled');
    const s = await client.auth.getSession();
    const user = s.data.session?.user;
    if (s.error || !user) throw Error('session');
    const jwt = await client.rpc('usuario_atual_id');
    if (jwt.error || jwt.data !== user.id) throw Error('identity');
    const p = await client.from('usuarios_auxiliares').select('perfil').eq('user_id', user.id).maybeSingle();
    if (p.error || !p.data || !['admin','auxiliar','coordenadora'].includes(p.data.perfil)) throw Error('profile');
    return { id: user.id, perfil: String(p.data.perfil) };
  }
  async function snapshot(f: Fixture, revision: number, count: number) {
    if (!client) throw Error('disabled');
    const r = await client.from('rodizios').select('id,titulo,status,travado,revisao,data_inicio,data_fim').eq('id',f.id).maybeSingle();
    const i = await client.from('rodizio_itens').select('*').eq('rodizio_id',f.id).order('id');
    if (r.error || i.error || !r.data || !i.data || r.data.titulo !== f.titulo || r.data.status !== f.status || r.data.travado !== f.travado || String(r.data.revisao) !== String(revision) || i.data.length !== count || String(r.data.data_inicio).slice(0,10) !== '2026-12-01' || String(r.data.data_fim).slice(0,10) !== '2026-12-31') throw Error('fixture');
    return { header: r.data, items: i.data };
  }
  async function test(s: Scenario) {
    if (!client || attempted.current.has(s)) return;
    const actor = await identity();
    if (actor.perfil !== 'admin') throw Error('admin required');
    const f = s === 'stale' || s === 'locked' ? locked : s === 'published' ? published : draft;
    const before = await snapshot(f,f.revisao,f.count);
    if ((await identity()).id !== actor.id) throw Error('session changed');
    const key = 'sql13-attempt-' + s;
    if (sessionStorage.getItem(key)) throw Error('already attempted');
    sessionStorage.setItem(key,'1'); attempted.current.add(s);
    const response = await client.rpc('substituir_itens_rodizio_rascunho_versionado',{
      p_rodizio_id:f.id,p_revisao_esperada:s==='stale'?1:f.revisao,
      p_itens:[{data:'2026-12-15',porta:'Entrada',auxiliar_id:s==='invalid-fk'?'ffffffff-ffff-4fff-8fff-ffffffffffff':null,observacoes:'TESTE SQL13'}]
    });
    if ((await identity()).id !== actor.id) throw Error('session changed');
    const after = await snapshot(f,s==='valid'&&!response.error?1:f.revisao,s==='valid'&&!response.error?1:f.count);
    const code = response.error?.code ?? null;
    const expected = s==='stale'?'P0001':s==='invalid-fk'?'23503':s==='valid'?null:'42501';
    const valid = s==='valid' ? !response.error && String(response.data)==='1' && after.items[0]?.porta==='Entrada' && after.items[0]?.observacoes==='TESTE SQL13' : code===expected && JSON.stringify(before)===JSON.stringify(after) && (expected!=='42501'||(response.error?.message??'').includes('Substituicao permitida somente'));
    setResult(JSON.stringify({branch:'br-little-hill-b6q7979y',scenario:s,perfil:actor.perfil,sqlstate:code,expected,approved:valid},null,2));
    if (!valid) setHalted(true);
  }
  if (!local) return <p>Cliente bloqueado: somente Vite DEV em http://localhost:5173.</p>;
  return <main style={{maxWidth:600,margin:'20px auto',padding:16,fontFamily:'system-ui'}}>
    <h1>SQL13 — teste isolado</h1><p>Branch descartável br-little-hill-b6q7979y. Não envie OTP ou JWT. Execute o positivo por último.</p>
    <label>E-mail <input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <p><button disabled={busy||halted||!email} onClick={()=>void run(async()=>{const r=await client!.auth.signInWithOtp({email:email.trim()}); if(r.error) throw Error('otp');setResult('Código solicitado.');})}>Solicitar OTP</button></p>
    <label>Código <input value={otp} onChange={e=>setOtp(e.target.value)} autoComplete="one-time-code" /></label>
    <p><button disabled={busy||halted||!otp} onClick={()=>void run(async()=>{const r=await client!.auth.verifyOtp({email:email.trim(),token:otp.trim(),type:'email'});setOtp('');if(r.error)throw Error('otp');setResult('Perfil confirmado: '+(await identity()).perfil);})}>Confirmar OTP</button></p>
    <button disabled={busy||halted} onClick={()=>void run(async()=>setResult('Perfil confirmado: '+(await identity()).perfil))}>Verificar identidade</button>
    {(['stale','locked','published','invalid-fk','valid'] as const).map(s=><p key={s}><button disabled={busy||halted||attempted.current.has(s)} onClick={()=>void run(()=>test(s))}>{s}</button></p>)}
    <pre style={{whiteSpace:'pre-wrap'}}>{result}</pre>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
