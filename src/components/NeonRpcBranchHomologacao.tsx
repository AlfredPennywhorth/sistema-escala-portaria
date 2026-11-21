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
  const [negativasSql06Interrompidas, setNegativasSql06Interrompidas] = useState(false);
  const [p07Tentado, setP07Tentado] = useState(false);

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

  async function testarNegativaSql06(
    cenario: 'N01' | 'N02' | 'N03' | 'N04',
  ) {
    // Nenhum positivo Admin aqui. O teste é uma prova real de permissão
    // JWT com conta sem perfil admin, exclusivamente na branch descartável.
    // Se o servidor permitir qualquer RPC, interromper as demais provas.
    if (negativasSql06Interrompidas) {
      setMensagem('Provas SQL06 suspensas após divergência. Conferir banco.');
      return;
    }
    const sessao = await perfilAtual();
    if (!sessao) return;
    if (sessao.perfil === 'admin') {
      setMensagem('SQL06 N01–N04 exigem perfil Auxiliar ou Coordenadora, nunca Admin.');
      return;
    }
    const testes = {
      N01: {
        funcao: 'criar_rodizio_rascunho_versionado',
        args: { p_titulo: 'TESTE SQL06 NEGATIVA JWT FICTICIO',
          p_data_inicio: '2027-04-01', p_data_fim: '2027-04-30',
          p_observacoes: 'NEGATIVA JWT; nao deve criar nenhuma escala' },
      },
      N02: {
        funcao: 'atualizar_cabecalho_rascunho_versionado',
        args: { p_rodizio_id: '00000000-0000-4000-8000-000000000209',
          p_revisao_esperada: 0,
          p_titulo: 'TESTE SQL06 EDICAO INDEVIDA',
          p_data_inicio: '2027-01-10', p_data_fim: '2027-01-31',
          p_observacoes: 'NAO AUTORIZAR' },
      },
      N03: {
        funcao: 'cancelar_rodizio_versionado',
        args: { p_rodizio_id: '00000000-0000-4000-8000-000000000210',
          p_revisao_esperada: 0 },
      },
      N04: {
        funcao: 'excluir_rodizio_rascunho_versionado',
        args: { p_rodizio_id: '00000000-0000-4000-8000-000000000211',
          p_revisao_esperada: 0 },
      },
    } as const;
    const { funcao, args } = testes[cenario];
    const resposta = await CLIENTE.rpc(funcao, args);
    const codigo = resposta.error?.code ?? null;
    const negacaoPorAdmin = codigo === '42501' &&
      (resposta.error?.message ?? '').includes('Somente administrador autenticado');
    if (!negacaoPorAdmin) setNegativasSql06Interrompidas(true);
    setResultado(JSON.stringify({
      ambiente: 'br-holy-term-b6v6ofea',
      fase: 'SQL06 negativa JWT real',
      cenario,
      perfil: sessao.perfil,
      funcao,
      aprovado: negacaoPorAdmin,
      resultado: negacaoPorAdmin
        ? 'APROVADO: banco negou a operação por falta de perfil Admin'
        : 'BLOQUEIO: resultado inesperado; pare e peça conferência independente',
      sqlstate: codigo,
      detalhe: resposta.error?.message ?? 'ATENÇÃO: resposta sem erro!',
      // Nunca registrar JWT, token de login ou dados pessoais.
    }, null, 2));
    setMensagem(negacaoPorAdmin
      ? 'Negativa SQL06 recusada pelo banco. Envie apenas o resumo de resultado.'
      : 'Teste não aprovado. Não execute outros testes. Conferir fixtures no banco.');
  }


  async function testarPositivaSql06P07() {
    // Exclusão IRREVERSÍVEL apenas na branch descartável. Nunca repetir após
    // timeout. P01 e demais fixtures ficam fora do escopo desta RPC.
    if (p07Tentado) {
      setMensagem('P07 já tentado nesta sessão. Não repetir; conferir o banco.');
      return;
    }
    const sessao = await perfilAtual();
    if (!sessao || sessao.perfil !== 'admin') {
      setMensagem('Somente JWT Administrador pode iniciar SQL06 P07.');
      return;
    }
    const id = '00000000-0000-4000-8000-000000000211';
    const itemId = '00000000-0000-4000-8000-000000000311';
    const tituloCriacaoP01 = 'TESTE SQL06 P01 CRIACAO JWT ADMIN UNICA 20261121';
    const p01 = await CLIENTE.from('rodizios')
      .select('id,status,travado,revisao').eq('titulo', tituloCriacaoP01);
    if (p01.error || p01.data?.length !== 1 ||
      p01.data[0].id !== '47f6adaf-4fe4-4837-a84c-078ed6b41fed' ||
      p01.data[0].status !== 'rascunho' || p01.data[0].travado !== false ||
      String(p01.data[0].revisao) !== '0') {
      setMensagem('P07 bloqueado: P01 não está íntegro ou contém duplicidade.');
      return;
    }
    const anterior = await CLIENTE.from('rodizios')
      .select('id,titulo,status,travado,revisao,data_inicio,data_fim')
      .eq('id', id).maybeSingle();
    if (anterior.error || !anterior.data ||
      anterior.data.id !== id ||
      anterior.data.titulo !== 'TESTE SQL06 EXCLUSAO EXCLUSIVO' ||
      anterior.data.status !== 'rascunho' ||
      anterior.data.travado !== false ||
      String(anterior.data.revisao) !== '0' ||
      anterior.data.data_inicio !== '2027-03-01' ||
      anterior.data.data_fim !== '2027-03-31') {
      setMensagem('P07 bloqueado: fixture 211 divergente ou já utilizada.');
      return;
    }
    const itensAnteriores = await CLIENTE.from('rodizio_itens')
      .select('id,rodizio_id,data,porta,periodo,auxiliar_id')
      .eq('rodizio_id', id);
    if (itensAnteriores.error || itensAnteriores.data?.length !== 1 ||
      itensAnteriores.data[0].id !== itemId ||
      itensAnteriores.data[0].rodizio_id !== id ||
      itensAnteriores.data[0].data !== '2027-03-15' ||
      itensAnteriores.data[0].porta !== 'TESTE SQL06 EXCLUIR' ||
      itensAnteriores.data[0].periodo !== 'HML' ||
      itensAnteriores.data[0].auxiliar_id !== null) {
      setMensagem('P07 bloqueado: dependências da fixture 211 divergentes.');
      return;
    }
    // Bloqueio antes da chamada, inclusive diante de erro de transporte.
    setP07Tentado(true);
    const resposta = await CLIENTE.rpc('excluir_rodizio_rascunho_versionado', {
      p_rodizio_id: id,
      p_revisao_esperada: 0,
    });
    const depois = await CLIENTE.from('rodizios')
      .select('id').eq('id', id);
    const itensDepois = await CLIENTE.from('rodizio_itens')
      .select('id').eq('rodizio_id', id);
    const p01Depois = await CLIENTE.from('rodizios')
      .select('id').eq('id', p01.data[0].id);
    const preservados = await CLIENTE.from('rodizios')
      .select('id,status,revisao').in('id', [
        '00000000-0000-4000-8000-000000000209',
        '00000000-0000-4000-8000-000000000210',
      ]);
    const p02Preservado = preservados.data?.some(r =>
      r.id === '00000000-0000-4000-8000-000000000209' &&
      r.status === 'rascunho' && String(r.revisao) === '1');
    const p05Preservado = preservados.data?.some(r =>
      r.id === '00000000-0000-4000-8000-000000000210' &&
      r.status === 'cancelado' && String(r.revisao) === '1');
    const aprovado = !resposta.error && resposta.data === true &&
      !depois.error && depois.data?.length === 0 &&
      !itensDepois.error && itensDepois.data?.length === 0 &&
      !p01Depois.error && p01Depois.data?.length === 1 &&
      p01Depois.data[0].id === p01.data[0].id &&
      !preservados.error && preservados.data?.length === 2 &&
      p02Preservado && p05Preservado;
    setResultado(JSON.stringify({
      ambiente: 'br-holy-term-b6v6ofea',
      cenario: 'P07',
      perfil: sessao.perfil,
      funcao: 'excluir_rodizio_rascunho_versionado',
      situacao: aprovado ? 'P07 aprovado na interface; exigir SELECT independente'
        : 'P07 inconclusivo ou falhou; NÃO REPETIR; exigir SELECT independente',
      sqlstate: resposta.error?.code ?? null,
      erroBanco: resposta.error?.message ?? null,
      idExcluido: id,
      itemExcluido: itemId,
      retorno: resposta.error ? null : resposta.data,
      registros211Depois: depois.error ? null : depois.data?.length,
      itens311Depois: itensDepois.error ? null : itensDepois.data?.length,
      p01Preservado: !p01Depois.error && p01Depois.data?.length === 1,
      p02Preservado: !!p02Preservado,
      p05Preservado: !!p05Preservado,
    }, null, 2));
    setMensagem('P07 encerrado nesta sessão; não repetir. Envie o resultado para reconciliação independente.');
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
            Consulta das fixtures 206, 207 e 208 permanece somente leitura.
            Testes positivos SQL06 seguem gate sequencial separado: P02 já
            concluído; somente P05 na fixture 210 liberado para JWT Administrador.
            P01 e P07 continuam bloqueados.
          </p>
          <button type="button" disabled={ocupado}
            className="w-full rounded-md border border-blue-600 p-3 disabled:opacity-50"
            onClick={() => void executar(preflightSql06SomenteLeitura)}>
            SQL 06 — conferir fixtures (somente leitura)
          </button>
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-base font-semibold">SQL 06 — negativas por perfil</h3>
            <p className="text-xs text-amber-900">
              N01–N04: somente Auxiliar ou Coordenadora com JWT da branch descartável.
              Nenhum resultado deve ser sucesso. Se houver divergência, os
              demais testes ficam bloqueados. Não usar conta Administrador.
            </p>
            {([
              ['N01', 'Negar criação de rascunho'],
              ['N02', 'Negar edição da fixture 209'],
              ['N03', 'Negar cancelamento da fixture 210'],
              ['N04', 'Negar exclusão da fixture 211'],
            ] as const).map(([cenario, descricao]) => (
              <button type="button" key={cenario}
                disabled={ocupado || negativasSql06Interrompidas}
                className="w-full rounded-md border border-amber-600 p-3 disabled:opacity-50"
                onClick={() => void executar(() => testarNegativaSql06(cenario))}>
                {cenario} — {descricao} (Auxiliar/Coordenadora)
              </button>
            ))}
          </div>
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-base font-semibold">SQL 06 — positivos JWT Administrador</h3>
            <p className="text-xs text-amber-900">
              Gate sequencial: P02, P05 e P01 concluídos e conferidos.
              Somente P07 está disponível para Admin, sobre fixture 211 fictícia.
              Exclusão irreversível na branch descartável: após qualquer tentativa, não repetir.
            </p>
            <p role="note" className="rounded-md bg-slate-100 p-3 text-xs">
              P02 — Edição da fixture 209: concluída, revisão 1. Botão removido.
            </p>
            <p role="note" className="rounded-md bg-slate-100 p-3 text-xs">
              P05 — Cancelamento da fixture 210: concluído, revisão 1. Botão removido.
            </p>
            <p role="note" className="rounded-md bg-slate-100 p-3 text-xs">
              P01 — Criação do rascunho único: concluída, revisão 0. Botão removido.
            </p>
            <button type="button" disabled={ocupado || p07Tentado}
              className="w-full rounded-md border border-red-600 p-3 disabled:opacity-50"
              onClick={() => void executar(testarPositivaSql06P07)}>
              P07 — Excluir fixture fictícia 211 uma única vez (Admin)
            </button>
          </div>
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
