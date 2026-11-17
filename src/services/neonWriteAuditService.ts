import { criarClienteNeon } from '../lib/neon';

type ResultadoEtapa = 'aprovado' | 'reprovado' | 'inconclusivo';
type ResultadoEscrita = {
  perfil: string;
  operacao: string;
  resultado: ResultadoEtapa;
  codigoErro: string | null;
  detalhe: string;
  limpeza: string;
  registroTesteId: string;
};

function erroDeAutorizacao(erro: { code?: string; message?: string; status?: number }) {
  // SQLSTATE 42501 é insufficient_privilege (inclui violações RLS).
  // Status HTTP 403 isoladamente pode vir de outra camada; não prova RLS.
  return erro.code === '42501' &&
    /row.level.security|policy|permission.denied|insufficient.privilege/i.test(erro.message ?? '');
}

/**
 * Auditoria HML com JWT real, sem modificar escalas existentes.
 * Uma tentativa de INSERT pode ter sido aplicada mesmo com resposta incerta.
 * Portanto a rotina procura e remove exclusivamente seu próprio UUID.
 */
export async function verificarEscritaRestricoesNeon(): Promise<{
  erro: string | null; dados: ResultadoEscrita | null;
}> {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { erro: 'Somente disponível no ambiente isolado de homologação.', dados: null };
  }

  const cliente = criarClienteNeon();
  const sessao = await cliente.auth.getSession();
  if (sessao.error) return { erro: sessao.error.message, dados: null };
  const usuario = sessao.data.session?.user;
  if (!usuario) return { erro: 'Sessão autenticada obrigatória.', dados: null };

  const emailsPermitidos = ['andre.w.souza@outlook.com', 'aws311274@gmail.com'];
  if (!emailsPermitidos.includes((usuario.email ?? '').toLowerCase())) {
    return { erro: 'Conta não autorizada para executar testes de escrita em HML.', dados: null };
  }

  const perfil = await cliente.from('usuarios_auxiliares')
    .select('perfil,auxiliar_id')
    .eq('user_id', usuario.id)
    .maybeSingle();
  if (perfil.error) return { erro: perfil.error.message, dados: null };
  if (!perfil.data?.auxiliar_id) {
    return { erro: 'Conta sem auxiliar de teste vinculada.', dados: null };
  }
  if (!['auxiliar', 'coordenadora', 'admin'].includes(perfil.data.perfil)) {
    return { erro: 'Perfil não reconhecido para esta auditoria.', dados: null };
  }

  const esperadoPermitir = perfil.data.perfil !== 'auxiliar';
  const id = crypto.randomUUID();
  const retorno: ResultadoEscrita = {
    perfil: perfil.data.perfil,
    operacao: 'INSERT em restricoes_auxiliares',
    resultado: 'inconclusivo',
    codigoErro: null,
    detalhe: '',
    limpeza: 'pendente',
    registroTesteId: id,
  };

  let erroInsert: { code?: string; message?: string } | null = null;
  let idConfirmado = false;
  try {
    const insercao = await cliente.from('restricoes_auxiliares')
      .insert({
        id,
        auxiliar_id: perfil.data.auxiliar_id,
        tipo: 'observacao',
        motivo: 'TESTE HML RLS ' + id,
        ativa: true,
      })
      .select('id')
      .maybeSingle();

    erroInsert = insercao.error;
    retorno.codigoErro = insercao.error?.code ?? null;
    idConfirmado = insercao.data?.id === id;

    if (insercao.error) {
      const negadoPeloBanco = erroDeAutorizacao(insercao.error);
      retorno.resultado = !esperadoPermitir && negadoPeloBanco ? 'aprovado' : 'inconclusivo';
      retorno.detalhe = negadoPeloBanco
        ? 'Negativa de autorização SQLSTATE 42501: ' + insercao.error.message
        : 'Falha não comprova RLS (rede, sessão, schema ou integridade): ' + insercao.error.message;
    } else if (!idConfirmado) {
      retorno.resultado = 'inconclusivo';
      retorno.detalhe = 'INSERT sem UUID confirmado; resultado não prova permissão ou bloqueio.';
    } else {
      retorno.resultado = esperadoPermitir ? 'aprovado' : 'reprovado';
      retorno.detalhe = esperadoPermitir
        ? 'INSERT autorizado pelo banco.'
        : 'ALERTA: Auxiliar conseguiu inserir restrição, contrariando a política esperada.';
    }
  } catch (erro) {
    retorno.resultado = 'inconclusivo';
    retorno.detalhe = 'Falha de transporte/execução no INSERT: ' + String(erro);
  }

  // Sempre tentar limpeza, mesmo após erro de INSERT ou resposta inconclusiva.
  // O UUID conhecido identifica apenas o registro criado por este teste.
  try {
    const remocao = await cliente.from('restricoes_auxiliares')
      .delete().eq('id', id).select('id');
    if (remocao.error) {
      retorno.limpeza = 'não confirmada (DELETE): ' + remocao.error.message + '; UUID ' + id;
    } else if (remocao.data?.some((linha) => linha.id === id)) {
      retorno.limpeza = 'confirmada: registro fictício removido';
    } else {
      // A ausência de linha removida não comprova ausência física, pois SELECT
      // e DELETE são filtrados por RLS. Preservar a incerteza para revisão.
      retorno.limpeza = 'nenhuma linha removida; existência não verificável via RLS. UUID ' + id;
    }
  } catch (erro) {
    retorno.limpeza = 'falha de comunicação na limpeza: ' + String(erro) + '; UUID ' + id;
  }

  if (esperadoPermitir && retorno.resultado === 'aprovado' &&
      retorno.limpeza !== 'confirmada: registro fictício removido') {
    retorno.resultado = 'inconclusivo';
    retorno.detalhe += ' Limpeza precisa ser confirmada antes da aprovação.';
  }
  if (!esperadoPermitir && !erroInsert && idConfirmado) {
    retorno.resultado = 'reprovado';
  }
  return { erro: null, dados: retorno };
}
