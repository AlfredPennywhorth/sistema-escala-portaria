import { useState } from 'react';
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

// URLs públicas da branch Neon DESCARTÁVEL, não são senhas nem conexões SQL.
// Nunca apontar para a HML principal ou para produção.
const AUTH_URL = 'https://ep-nameless-dust-b6271958.neonauth.c-2.sa-east-1.aws.neon.tech/rodizio_portas/auth';
const DATA_URL = 'https://ep-nameless-dust-b6271958.apirest.c-2.sa-east-1.aws.neon.tech/rodizio_portas/rest/v1';
const ESCALA_FICTICIA = '00000000-0000-4000-8000-000000000205';
const AUXILIAR_FICTICIA = '00000000-0000-4000-8000-000000000201';
const ESCALA_TRANSICAO = '00000000-0000-4000-8000-000000000206';
const ESCALA_VAZIA = '00000000-0000-4000-8000-000000000207';
const ESCALA_NEGATIVA_TRAVAMENTO = '00000000-0000-4000-8000-000000000208';
const TITULO_NEGATIVA_TRAVAMENTO = 'TESTE FICTICIO NEGATIVA TRAVAMENTO JWT';
const TITULO_TRANSICAO = 'TESTE FICTICIO TRANSICAO OCC COM ITEM';
const TITULO_VAZIA = 'TESTE FICTICIO TRANSICAO OCC SEM ITEM';
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

  async function preflightSql06SomenteLeitura() {
    // A autorização recebida permite a INSTALAÇÃO SQL06, não mutações
    // de fixtures adicionais. Nenhuma função RPC é chamada neste preflight.
    const sessao = await perfilAtual();
    if (!sessao) return;
    const ids = [
      '00000000-0000-4000-8000-000000000206',
      '00000000-0000-4000-8000-000000000207',
      '00000000-0000-4000-8000-000000000208',
    ];
    const consulta = await CLIENTE.from('rodizios')
      .select('id,titulo,status,travado,revisao,travado_em')
      .in('id', ids)
      .order('id', { ascending: true });
    if (consulta.error) {
      setMensagem('Preflight SQL06 inconclusivo: ' + consulta.error.message);
      return;
    }

    // A RLS pode ocultar rascunhos para perfis não administrativos.
    // Não interpretar linhas ausentes como objetos apagados.
    const contagem = await CLIENTE.from('rodizio_itens')
      .select('id,rodizio_id').in('rodizio_id', ids);
    if (contagem.error) {
      setMensagem('Falha na leitura dos itens (RLS ou conexão). Não executar escritas.');
      return;
    }
    const quantidades = new Map<string, number>();
    for (const item of contagem.data ?? []) {
      quantidades.set(item.rodizio_id, (quantidades.get(item.rodizio_id) ?? 0) + 1);
    }
    const linhas = (consulta.data ?? []).map(item => ({
      id: item.id,
      status: item.status,
      travado: item.travado,
      revisao: item.revisao,
      itensVisiveis: quantidades.get(item.id) ?? 0,
    }));
    const aprovacaoAdmin = sessao.perfil === 'admin' &&
      linhas.length === 3 &&
      linhas.some(item => item.id === ids[0] && item.status === 'travado' &&
        item.travado === true && String(item.revisao) === '2' && item.itensVisiveis === 1) &&
      linhas.some(item => item.id === ids[1] && item.status === 'rascunho' &&
        item.travado === false && String(item.revisao) === '0' && item.itensVisiveis === 0) &&
      linhas.some(item => item.id === ids[2] && item.status === 'publicado' &&
        item.travado === false && String(item.revisao) === '0' && item.itensVisiveis === 1);
    setResultado(JSON.stringify({
      ambiente: 'Neon descartável br-holy-term-b6v6ofea',
      fase: 'SQL06: apenas SELECT — sem chamada RPC',
      perfil: sessao.perfil,
      estado: sessao.perfil === 'admin'
        ? (aprovacaoAdmin ? 'preflight de dados aprovado' : 'preflight divergente; conferir banco')
        : 'leitura sujeita a RLS — não avaliar integridade com este perfil',
      registrosVisiveis: linhas,
      sql06: 'funções instaladas, porém nenhuma transição SQL06 executada nesta tela',
    }, null, 2));
    setMensagem('Somente leitura concluída. Não foram alterados dados.');
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


  async function executarTransicaoVersionada(
    operacao: 'publicar' | 'travar' | 'vazio' | 'negativa-publicar' | 'negativa-travar',
  ) {
    // Fixtures SQL05 206 consumidas (travado, revisão 2). A proteção
    // independe do botão: bloquear qualquer invocação futura dos positivos.
    if (operacao === 'publicar' || operacao === 'travar') {
      setMensagem('T01/T04 encerrados: fixture 206 já travada. Não repetir.');
      return;
    }
    const sessao = await perfilAtual();
    if (!sessao) return;
    const negativa = operacao === 'negativa-publicar' || operacao === 'negativa-travar';
    if (negativa && sessao.perfil === 'admin') {
      setMensagem('Entre como Auxiliar ou Coordenadora para a negativa por perfil.');
      return;
    }
    if (!negativa && sessao.perfil !== 'admin') {
      setMensagem('Somente Administrador pode executar os testes positivos e de validação.');
      return;
    }

    const id = operacao === 'vazio' ? ESCALA_VAZIA
      : operacao === 'negativa-travar' ? ESCALA_NEGATIVA_TRAVAMENTO
        : ESCALA_TRANSICAO;
    const esperado = operacao === 'negativa-travar'
      ? { titulo: TITULO_NEGATIVA_TRAVAMENTO, status: 'publicado', revisao: 0, travado: false }
      : operacao === 'vazio'
        ? { titulo: TITULO_VAZIA, status: 'rascunho', revisao: 0, travado: false }
        : { titulo: TITULO_TRANSICAO, status: 'rascunho', revisao: 0, travado: false };
    const antes = await CLIENTE.from('rodizios')
      .select('id,titulo,status,travado,revisao,travado_em')
      .eq('id', id).maybeSingle();
    if (antes.error) {
      setMensagem('Falha ao ler a fixture da transição. Não executar a RPC.');
      return;
    }
    // O perfil não-admin pode não visualizar rascunho pela RLS. Já a
    // fixture 208 publicada precisa ser visível para esta prova negativa:
    // estado, revisão e título são validados ANTES de solicitar a RPC.
    const validarFixture = !negativa || operacao === 'negativa-travar';
    if (validarFixture && (!antes.data ||
        antes.data.titulo !== esperado.titulo ||
        antes.data.status !== esperado.status ||
        antes.data.travado !== esperado.travado ||
        String(antes.data.revisao) !== String(esperado.revisao))) {
      setMensagem('Fixture divergente ou já utilizada; operação cancelada. Não repetir.');
      return;
    }
    if (!negativa) {
      const itens = await CLIENTE.from('rodizio_itens')
        .select('id').eq('rodizio_id', id).limit(2);
      if (itens.error || itens.data?.length !== (operacao === 'vazio' ? 0 : 1)) {
        setMensagem('Quantidade de itens divergente. Operação não enviada.');
        return;
      }
    }

    const fn = operacao === 'negativa-travar'
      ? 'travar_rodizio_versionado' : 'publicar_rodizio_versionado';
    const resposta = await CLIENTE.rpc(fn, {
      p_rodizio_id: id,
      p_revisao_esperada: 0,
    });
    const codigo = resposta.error?.code ?? null;
    // Uma recusa por ESTADO também pode usar 42501. Só aceitar o teste
    // negativo se a mensagem corresponder à autorização da própria RPC.
    const mensagemErro = resposta.error?.message ?? '';
    const negadoPorPerfil = codigo === '42501' &&
      (operacao === 'negativa-travar'
        ? mensagemErro.includes('Somente administrador autenticado pode travar')
        : mensagemErro.includes('Somente administrador autenticado pode publicar'));
    const depois = sessao.perfil === 'admin'
      ? await CLIENTE.from('rodizios')
        .select('id,titulo,status,travado,revisao,travado_em')
        .eq('id', id).maybeSingle()
      : null;
    let situacao: string;
    if (negativa) {
      situacao = negadoPorPerfil ? 'aprovado: autorização negada pelo banco'
        : resposta.error ? 'REPROVADO/inconclusivo: SQL não confirmou negativa por perfil'
          : 'REPROVADO: perfil não-admin executou RPC';
    } else if (operacao === 'vazio') {
      situacao = codigo === '22023' &&
        String(depois?.data?.revisao) === '0' &&
        depois?.data?.status === 'rascunho'
        ? 'aprovado: não publicou escala vazia'
        : 'inconclusivo/reprovado: conferir banco';
    } else if (resposta.error || depois?.error) {
      situacao = !codigo || !/^[0-9A-Z]{5}$/.test(codigo)
        ? 'indeterminado: confira banco antes de repetir'
        : 'recusado pelo banco: ' + codigo;
    } else {
      const novaRevisao = 1;
      const novoEstado = 'publicado';
      situacao = String(resposta.data) === String(novaRevisao) &&
        String(depois?.data?.revisao) === String(novaRevisao) &&
        depois?.data?.status === novoEstado &&
        depois?.data?.travado === false
        ? 'aprovado: transição versionada com JWT Admin real'
        : 'inconclusivo: revisão/estado divergente; não repetir';
    }
    setResultado(JSON.stringify({
      ambiente: 'Neon descartável br-holy-term-b6v6ofea',
      perfil: sessao.perfil, operacao, id, resultado: situacao,
      codigoErro: codigo, erroBanco: resposta.error?.message ?? null,
      revisaoAntes: antes.data?.revisao ?? null,
      revisaoDepois: depois?.data?.revisao ?? null,
      estadoDepois: depois?.data?.status ?? null,
      retorno: resposta.error ? null : resposta.data,
    }, null, 2));
    setMensagem('Guarde somente o resultado. Não envie OTP ou JWT; não repita testes positivos.');
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
        <div className="border-t pt-4 space-y-2">
          <h2 className="text-lg font-semibold">SQL 06 — pré-homologação</h2>
          <p className="text-sm text-amber-900">
            Apenas consulta das fixtures 206, 207 e 208. As quatro funções SQL 06
            foram instaladas, mas testes de mutação exigem outro gate. Não criar,
            editar, cancelar ou excluir escalas nesta etapa.
          </p>
          <button type="button" disabled={ocupado}
            className="w-full rounded-md border border-blue-600 p-3 disabled:opacity-50"
            onClick={() => void executar(preflightSql06SomenteLeitura)}>
            SQL 06 — conferir fixtures (somente leitura)
          </button>
        </div>
        <button type="button" disabled={ocupado} className="w-full rounded-md border border-amber-500 p-3 disabled:opacity-50"
          onClick={() => void executar(() => executarProva(true))}>
          Testar negativa da RPC (Auxiliar ou Coordenadora)
        </button>
        <p className="rounded-md border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700" role="note">
          Teste positivo legado da fixture 205 já consumido. Não repetir gravações.
        </p>
        <div className="border-t pt-4 space-y-2">
          <h2 className="text-lg font-semibold">SQL 05 — transições com JWT real</h2>
          <p className="text-xs text-amber-900">
            Testes positivos T01/T04 já concluídos: fixture 206 travada, revisão 2.
            Não repetir. Permanecem disponíveis apenas as negativas de autorização
            e o teste de recusa de escala vazia, sempre na branch descartável.
          </p>
          <button type="button" disabled={ocupado} className="w-full rounded-md border p-3 disabled:opacity-50"
            onClick={() => void executar(() => executarTransicaoVersionada('negativa-publicar'))}>
            T10/T11 — Negar publicação (Auxiliar/Coordenadora)
          </button>
          <button type="button" disabled={ocupado} className="w-full rounded-md border p-3 disabled:opacity-50"
            onClick={() => void executar(() => executarTransicaoVersionada('negativa-travar'))}>
            T10/T11 — Negar travamento (Auxiliar/Coordenadora)
          </button>
          <button type="button" disabled={ocupado} className="w-full rounded-md border p-3 disabled:opacity-50"
            onClick={() => void executar(() => executarTransicaoVersionada('vazio'))}>
            T06 — Bloquear publicação de escala vazia (Admin)
          </button>
          <p className="rounded-md border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700" role="note">
            T01 — Publicação da fixture 206: concluído. Botão removido para impedir repetição.
          </p>
          <p className="rounded-md border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700" role="note">
            T04 — Travamento da fixture 206: concluído. Botão removido para impedir repetição.
          </p>
        </div>
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
