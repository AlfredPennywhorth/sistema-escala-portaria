import { criarClienteNeon } from '../lib/neon';

const ID_ESCALA_TRAVADA = '00000000-0000-4000-8000-000000000204';
const TITULO_FIXTURE = 'TESTE FICTICIO TRAVADO';
const EMAIL_ADMIN_HML = 'andre.w.souza@outlook.com.br';

type Resultado = {
  perfil: string;
  teste: string;
  resultado: 'aprovado' | 'reprovado' | 'inconclusivo';
  codigoErro: string | null;
  detalhe: string;
  estadoAntes: string;
  estadoDepois: string;
};

/**
 * Testa o bloqueio do gatilho em escala TRAVADA com a sessão real de Admin.
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
    detalhe: '',
    estadoAntes: 'travado; titulo fictício validado',
    estadoDepois: 'pendente',
  };
  try {
    const tentativa = await cliente.from('rodizios')
      .update({ titulo: TITULO_FIXTURE }).eq('id', ID_ESCALA_TRAVADA);
    retorno.codigoErro = tentativa.error?.code ?? null;
    if (!tentativa.error) {
      retorno.resultado = 'reprovado';
      retorno.detalhe = 'ALERTA: UPDATE da escala travada não foi bloqueado pelo banco.';
    } else if (/travado|bloquead|hist[oó]ric|modifica[cç][aã]o/i.test(tentativa.error.message) &&
               ['P0001', '23514'].includes(tentativa.error.code ?? '')) {
      retorno.resultado = 'aprovado';
      retorno.detalhe = 'Gatilho de integridade recusou a alteração: ' + tentativa.error.message;
    } else {
      retorno.detalhe = 'Erro não comprova o gatilho de bloqueio: ' + tentativa.error.message;
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
