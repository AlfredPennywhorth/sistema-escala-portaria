import { criarClienteNeon } from '../lib/neon';

const ID_ESCALA_TRAVADA = '00000000-0000-4000-8000-000000000204';
const TITULO_FIXTURE = 'TESTE FICTICIO TRAVADO';
const EMAIL_ADMIN_HML = 'andre.w.souza@outlook.com.br';

type Resultado = {
  perfil: string;
  teste: string;
  resultado: 'aprovado' | 'reprovado' | 'inconclusivo';
  codigoErro: string | null;
  linhasAfetadas: number | null;
  mecanismoBloqueio: 'rls' | 'gatilho' | 'nao_confirmado';
  detalhe: string;
  estadoAntes: string;
  estadoDepois: string;
};

/**
 * Testa a proteção de escala TRAVADA com a sessão real de Admin.
 * A RLS pode filtrar o UPDATE antes que o gatilho por linha seja acionado.
 * O UPDATE é propositalmente idempotente (titulo recebe o valor já existente).
 * Não cria, altera ou apaga escalas, itens ou registros de produção.
 * Só executa se a fixture de HML corresponder a ID, título, status e travado.
 */
export async function verificarProtecaoHistoricoNeon(): Promise<{
  erro: string | null;
  dados: Resultado | null;
}> {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { erro: 'Teste disponível apenas na homologação Neon.', dados: null };
  }
  const cliente = criarClienteNeon();
  const sessao = await cliente.auth.getSession();
  if (sessao.error) return { erro: sessao.error.message, dados: null };
  const usuario = sessao.data.session?.user;
  if (!usuario) return { erro: 'Sessão autenticada obrigatória.', dados: null };
  if (usuario.email?.toLowerCase() !== EMAIL_ADMIN_HML) {
    return { erro: 'Teste restrito à conta Administrador de homologação.', dados: null };
  }
  const vinculo = await cliente.from('usuarios_auxiliares')
    .select('perfil').eq('user_id', usuario.id).maybeSingle();
  if (vinculo.error) return { erro: vinculo.error.message, dados: null };
  if (vinculo.data?.perfil !== 'admin') {
    return { erro: 'O banco não reconheceu o perfil Administrador.', dados: null };
  }

  const buscar = () => cliente.from('rodizios')
    .select('id,titulo,status,travado')
    .eq('id', ID_ESCALA_TRAVADA).maybeSingle();
  const antes = await buscar();
  if (antes.error) return { erro: antes.error.message, dados: null };
  const fixtureValida = antes.data?.id === ID_ESCALA_TRAVADA &&
    antes.data.titulo === TITULO_FIXTURE &&
    antes.data.status === 'travado' && antes.data.travado === true;
  if (!fixtureValida) {
    return { erro: 'Fixture travada não corresponde aos valores esperados; execução cancelada.', dados: null };
  }

  const retorno: Resultado = {
    perfil: 'admin',
    teste: 'UPDATE idempotente de escala travada',
    resultado: 'inconclusivo',
    codigoErro: null,
    linhasAfetadas: null,
    mecanismoBloqueio: 'nao_confirmado',
    detalhe: '',
    estadoAntes: 'travado; titulo fictício validado',
    estadoDepois: 'pendente',
  };
  try {
    // O Admin tem SELECT na fixture. RETURNING permite distinguir 0 linhas
    // filtradas pela policy UPDATE de 1 linha efetivamente atingida.
    const tentativa = await cliente.from('rodizios')
      .update({ titulo: TITULO_FIXTURE })
      .eq('id', ID_ESCALA_TRAVADA)
      .select('id');
    retorno.codigoErro = tentativa.error?.code ?? null;
    if (!tentativa.error) {
      retorno.linhasAfetadas = tentativa.data?.length ?? null;
      if (retorno.linhasAfetadas === 0) {
        retorno.resultado = 'inconclusivo';
        retorno.mecanismoBloqueio = 'rls';
        retorno.detalhe = 'A policy RLS impediu que o UPDATE atingisse a escala travada (0 linhas). Histórico preservado; gatilho não foi exercitado e permanece sem homologação por JWT.';
      } else if (retorno.linhasAfetadas === 1 && tentativa.data?.[0]?.id === ID_ESCALA_TRAVADA) {
        retorno.resultado = 'reprovado';
        retorno.detalhe = 'ALERTA: a escala travada foi atingida por UPDATE; proteção de escrita não confirmada.';
      } else {
        retorno.resultado = 'inconclusivo';
        retorno.detalhe = 'Retorno de linhas afetadas inesperado; revisar a resposta do banco.';
      }
    } else if (/travado|bloquead|hist[oó]ric|modifica[cç][aã]o/i.test(tentativa.error.message) &&
               ['P0001', '23514'].includes(tentativa.error.code ?? '')) {
      retorno.resultado = 'aprovado';
      retorno.mecanismoBloqueio = 'gatilho';
      retorno.detalhe = 'Gatilho de integridade recusou a alteração: ' + tentativa.error.message;
    } else {
      retorno.detalhe = 'Erro não comprova o bloqueio esperado: ' + tentativa.error.message;
    }
  } catch (erro) {
    retorno.detalhe = 'Erro de transporte; resultado inconclusivo: ' + String(erro);
  }

  const depois = await buscar();
  if (depois.error) {
    retorno.resultado = 'inconclusivo';
    retorno.estadoDepois = 'falha de leitura: ' + depois.error.message;
  } else if (depois.data?.id !== ID_ESCALA_TRAVADA ||
             depois.data.titulo !== TITULO_FIXTURE ||
             depois.data.status !== 'travado' ||
             depois.data.travado !== true) {
    retorno.resultado = 'reprovado';
    retorno.estadoDepois = 'ALERTA: fixture divergente após tentativa';
  } else {
    retorno.estadoDepois = 'travado; titulo fictício preservado';
  }
  return { erro: null, dados: retorno };
}
