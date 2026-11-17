import { criarClienteNeon } from '../lib/neon';

type ResultadoEtapa = 'aprovado' | 'reprovado' | 'nao_executado';
type ResultadoEscrita = {
  perfil: string;
  operacao: string;
  resultado: ResultadoEtapa;
  codigoErro: string | null;
  detalhe: string;
  limpeza: string;
};

/**
 * Verificação isolada da política INSERT em restricoes_auxiliares com JWT real.
 * A conta Auxiliar deve ser bloqueada; Coordenadora/Admin podem inserir.
 * Não modifica escalas nem outros registros. Quando permitido, remove SOMENTE
 * a linha criada, usando UUID imprevisível e confirmação de exclusão.
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

  // Evitar execução acidental com contas diferentes das preparadas para HML.
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
    resultado: 'nao_executado',
    codigoErro: null,
    detalhe: '',
    limpeza: 'nao necessaria',
  };

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

  retorno.codigoErro = insercao.error?.code ?? null;
  if (insercao.error) {
    retorno.resultado = esperadoPermitir ? 'reprovado' : 'aprovado';
    retorno.detalhe = esperadoPermitir
      ? 'INSERT deveria ser permitido; banco retornou erro: ' + insercao.error.message
      : 'INSERT negado pelo banco: ' + insercao.error.message;
    return { erro: null, dados: retorno };
  }

  if (insercao.data?.id !== id) {
    // Um INSERT sem linha retornada não é prova de bloqueio por RLS.
    retorno.resultado = 'reprovado';
    retorno.detalhe = 'INSERT não retornou o UUID esperado; verificar RLS e limpeza manual.';
    retorno.limpeza = 'verificacao manual necessaria para UUID ' + id;
    return { erro: null, dados: retorno };
  }

  // Nunca apagar registros existentes: filtro exato sobre o UUID criado.
  const limpeza = await cliente.from('restricoes_auxiliares')
    .delete()
    .eq('id', id)
    .select('id');
  const foiRemovido = !limpeza.error &&
    limpeza.data?.length === 1 && limpeza.data[0].id === id;
  retorno.limpeza = foiRemovido
    ? 'confirmada (somente registro do teste)'
    : 'FALHOU - verificar UUID ' + id;
  retorno.resultado = esperadoPermitir && foiRemovido ? 'aprovado' : 'reprovado';
  retorno.detalhe = esperadoPermitir
    ? 'INSERT autorizado; ' + (foiRemovido ? 'DELETE autorizado e confirmado.' : 'a limpeza não foi confirmada.')
    : 'ALERTA: Auxiliar conseguiu inserir restrição, contrariando a política esperada.';
  return { erro: null, dados: retorno };
}
