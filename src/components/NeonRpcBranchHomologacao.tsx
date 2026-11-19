import { useState } from 'react';
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

// URLs públicas da branch Neon DESCARTÁVEL, não são senhas nem conexões SQL.
// Nunca apontar para a HML principal ou para produção.
const AUTH_URL = 'https://ep-nameless-dust-b6271958.neonauth.c-2.sa-east-1.aws.neon.tech/rodizio_portas/auth';
const DATA_URL = 'https://ep-nameless-dust-b6271958.apirest.c-2.sa-east-1.aws.neon.tech/rodizio_portas/rest/v1';
const ESCALA_FICTICIA = '00000000-0000-4000-8000-000000000205';
const AUXILIAR_FICTICIA = '00000000-0000-4000-8000-000000000201';
const TITULO_FICTICIO = 'TESTE FICTICIO RPC JWT BRANCH TEMPORARIA';
const EMAILS_TESTE = [
  'andre.w.souza@outlook.com.br',
  'aws311274@gmail.com',
  'andre.w.souza@outlook.com',
];
const CLIENTE = createClient({
  auth: { url: AUTH_URL, adapter: SupabaseAuthAdapter(), allowAnonymous: false },
  dataApi: { url: DATA_URL },
});
type Perfil = 'admin' | 'coordenadora' | 'auxiliar';

export function NeonRpcBranchHomologacao() {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [resultado, setResultado] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setMensagem('');
    setResultado('');
    try { await acao(); }
    catch { setMensagem('Falha de comunicação; resultado indeterminado. Não repita a gravação sem conferir a branch.'); }
    finally { setOcupado(false); }
  }

  async function perfilAtual(): Promise<{ perfil: Perfil; id: string } | null> {
    const sessao = await CLIENTE.auth.getSession();
    if (sessao.error || !sessao.data.session?.user) {
      setMensagem('Autentique-se na branch temporária antes de executar.');
      return null;
    }
    const usuario = sessao.data.session.user;
    if (!EMAILS_TESTE.includes((usuario.email ?? '').toLowerCase())) {
      setMensagem('Conta não autorizada para esta homologação isolada.');
      return null;
    }
    const vinculo = await CLIENTE.from('usuarios_auxiliares')
      .select('perfil').eq('user_id', usuario.id).maybeSingle();
    if (vinculo.error || !vinculo.data || !['admin', 'coordenadora', 'auxiliar'].includes(vinculo.data.perfil)) {
      setMensagem('Perfil inexistente ou indisponível na branch temporária.');
      return null;
    }
    return { perfil: vinculo.data.perfil as Perfil, id: usuario.id };
  }

  async function executarProva(negativo: boolean) {
    const sessao = await perfilAtual();
    if (!sessao) return;
    if (negativo && sessao.perfil === 'admin') {
      setMensagem('Para o teste negativo, entre como Auxiliar ou Coordenadora.');
      return;
    }
    if (!negativo && sessao.perfil !== 'admin') {
      setMensagem('Teste positivo restrito ao Administrador.');
      return;
    }

    const escala = await CLIENTE.from('rodizios')
      .select('id,titulo,status,travado').eq('id', ESCALA_FICTICIA).maybeSingle();
    // Não permitir gravação na HML principal ou em outra escala.
    if (escala.error) {
      setMensagem('Erro ao conferir a escala de teste: ' + escala.error.message);
      return;
    }
    if (sessao.perfil === 'admin' &&
        (!escala.data || escala.data.titulo !== TITULO_FICTICIO ||
          escala.data.status !== 'rascunho' || escala.data.travado !== false)) {
      setMensagem('Fixture de teste divergente; gravação cancelada.');
      return;
    }

    const antes = sessao.perfil === 'admin'
      ? await CLIENTE.from('rodizio_itens').select('id,data,porta,auxiliar_id,observacoes')
        .eq('rodizio_id', ESCALA_FICTICIA).order('id')
      : null;
    if (antes?.error) {
      setMensagem('Não foi possível registrar o estado anterior da fixture.');
      return;
    }
    if (!negativo && (antes?.data?.length !== 1 ||
        antes.data[0].id !== '00000000-0000-4000-8000-000000000305' ||
        antes.data[0].porta !== 'TESTE RPC BASELINE' ||
        antes.data[0].observacoes !== 'TESTE TEMPORARIO JWT RPC ORIGINAL')) {
      setMensagem('Fixture original ja substituida ou divergente; nao repetir. Conferir a branch no Neon.');
      return;
    }

    const resposta = await CLIENTE.rpc('substituir_itens_rodizio_rascunho', {
      p_rodizio_id: ESCALA_FICTICIA,
      p_itens: [{
        data: '2026-12-15',
        porta: 'TESTE RPC JWT ' + sessao.perfil.toUpperCase(),
        periodo: 'HML',
        auxiliar_id: AUXILIAR_FICTICIA,
        observacoes: 'TESTE TEMPORARIO JWT RPC ' + sessao.perfil.toUpperCase(),
      }],
    });

    const codigoErro = resposta.error?.code ?? null;
    const negadoBanco = codigoErro === '42501' || codigoErro === 'P0002';
    const retornoIncerto = !!resposta.error && !negadoBanco;
    const depois = sessao.perfil === 'admin'
      ? await CLIENTE.from('rodizio_itens').select('id,data,porta,auxiliar_id,observacoes')
        .eq('rodizio_id', ESCALA_FICTICIA).order('id')
      : null;

    let resultadoProva: string;
    if (negativo) {
      resultadoProva = negadoBanco ? 'aprovado: RPC recusada pelo banco'
        : resposta.error ? 'inconclusivo: negativa sem SQLSTATE de autorização'
          : 'REPROVADO: perfil sem permissão conseguiu executar RPC';
    } else if (retornoIncerto || depois?.error) {
      resultadoProva = 'inconclusivo: conferir a branch antes de repetir';
    } else if (resposta.error) {
      resultadoProva = 'reprovado: falha SQL ' + codigoErro;
    } else if (resposta.data === 1 && depois?.data?.length === 1 &&
               depois.data[0].porta === 'TESTE RPC JWT ADMIN') {
      resultadoProva = 'aprovado: RPC executada com JWT Admin real';
    } else {
      resultadoProva = 'inconclusivo: retorno ou estado divergente';
    }

    setResultado(JSON.stringify({
      ambiente: 'Neon branch descartável br-holy-term-b6v6ofea',
      perfil: sessao.perfil,
      teste: negativo ? 'negativa por perfil' : 'gravação de fixture JWT Admin',
      resultado: resultadoProva,
      codigoErro,
      itensAntes: antes?.data?.length ?? null,
      itensDepois: depois?.data?.length ?? null,
      portaDepois: depois?.data?.[0]?.porta ?? null,
      // Nunca exibir JWT, senha, código OTP ou dados pessoais.
      observacao: 'Apenas fixture 205. Não há restauração automática; conferir no banco após teste.',
    }, null, 2));
    setMensagem('Teste concluído. Envie apenas o resumo de resultado, sem códigos de autenticação.');
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <section className="mx-auto max-w-md space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">RPC Neon — branch temporária</h1>
        <p className="text-sm text-amber-900">
          Ambiente descartável br-holy-term-b6v6ofea. Não é a HML principal nem a produção.
          Testes de gravação somente sobre escala fictícia exclusiva.
        </p>
        <label className="block text-sm font-medium" htmlFor="rpc-email">E-mail da conta HML</label>
        <input id="rpc-email" type="email" autoComplete="username"
          className="w-full rounded-md border p-3" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <button type="button" disabled={ocupado || !email.trim()} className="w-full rounded-md border p-3 disabled:opacity-50"
          onClick={() => void executar(async () => {
            if (!EMAILS_TESTE.includes(email.trim().toLowerCase())) {
              setMensagem('Utilize uma das três contas de homologação já provisionadas.');
              return;
            }
            const resposta = await CLIENTE.auth.signInWithOtp({ email: email.trim() });
            setMensagem(resposta.error?.message ?? 'Código solicitado. A entrega por e-mail ainda precisa ser confirmada.');
          })}>Solicitar código no Neon Auth temporário</button>
        <label className="block text-sm font-medium" htmlFor="rpc-codigo">Código recebido</label>
        <input id="rpc-codigo" inputMode="numeric" autoComplete="one-time-code"
          className="w-full rounded-md border p-3" value={codigo}
          onChange={(e) => setCodigo(e.target.value)} />
        <button type="button" disabled={ocupado || !codigo.trim() || !email.trim()} className="w-full rounded-md bg-blue-700 p-3 text-white disabled:opacity-50"
          onClick={() => void executar(async () => {
            const resposta = await CLIENTE.auth.verifyOtp({
              email: email.trim(), token: codigo.trim(), type: 'email',
            });
            setCodigo('');
            if (resposta.error) { setMensagem(resposta.error.message); return; }
            const perfil = await perfilAtual();
            setMensagem(perfil ? 'Sessão JWT confirmada. Perfil: ' + perfil.perfil : 'Sessão sem perfil confirmado.');
          })}>Confirmar OTP e conferir JWT</button>
        <button type="button" disabled={ocupado} className="w-full rounded-md border p-3 disabled:opacity-50"
          onClick={() => void executar(async () => {
            const perfil = await perfilAtual();
            if (perfil) setMensagem('Sessão válida na branch temporária: ' + perfil.perfil);
          })}>Verificar sessão e perfil</button>
        <button type="button" disabled={ocupado} className="w-full rounded-md border border-amber-500 p-3 disabled:opacity-50"
          onClick={() => void executar(() => executarProva(true))}>
          Testar negativa da RPC (Auxiliar ou Coordenadora)
        </button>
        <button type="button" disabled={ocupado} className="w-full rounded-md border border-red-500 p-3 disabled:opacity-50"
          onClick={() => void executar(() => executarProva(false))}>
          Testar gravação na fixture descartável (Admin)
        </button>
        <button type="button" disabled={ocupado} className="w-full rounded-md border p-3 disabled:opacity-50"
          onClick={() => void executar(async () => {
            const retorno = await CLIENTE.auth.signOut();
            const checagem = await CLIENTE.auth.getSession();
            setMensagem(checagem.data.session ? 'ATENÇÃO: sessão ainda ativa'
              : retorno.error ? 'Sessão ausente, erro do provedor: ' + retorno.error.message
                : 'Sessão encerrada e ausência confirmada.');
          })}>Encerrar sessão temporária</button>
        {mensagem && <p role="status" className="rounded-md bg-slate-100 p-3 text-sm">{mensagem}</p>}
        {resultado && <pre className="overflow-auto rounded-md bg-slate-100 p-3 text-xs">{resultado}</pre>}
        <p className="text-xs text-slate-500">Não compartilhar o código OTP nem executar o teste Admin repetidamente. A confirmação definitiva depende de SELECT independente no banco.</p>
      </section>
    </main>
  );
}
