import { criarClienteNeon } from '../lib/neon';

type Resultado = {
  perfil: 'admin';
  resultado: 'aprovado' | 'reprovado' | 'inconclusivo';
  operacao: string;
  fixtureId: string;
  registroTesteId: string;
  insercao: string;
  limpeza: string;
  codigoErro: string | null;
};

const RASCUNHO_ID = '00000000-0000-4000-8000-000000000202';
const AUXILIAR_FICTICIA_ID = '00000000-0000-4000-8000-000000000201';

/**
 * Teste explícito de escrita apenas em rascunho HML. Nunca toca histórico,
 * nem apaga os itens pré-existentes. UUID conhecido garante rastreabilidade.
 */
export async function verificarEscritaItensRascunhoNeon(): Promise<{
  erro: string | null;
  dados: Resultado | null;
}> {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { erro: 'Somente ambiente isolado de homologação Neon.', dados: null };
  }

  const cliente = criarClienteNeon();
  const sessao = await cliente.auth.getSession();
  if (sessao.error) return { erro: sessao.error.message, dados: null };
  const usuario = sessao.data.session?.user;
  if (!usuario || usuario.email?.toLowerCase() !== 'andre.w.souza@outlook.com.br') {
    return { erro: 'Teste restrito à conta Administrador de homologação.', dados: null };
  }

  const perfil = await cliente.from('usuarios_auxiliares').select('perfil')
    .eq('user_id', usuario.id).maybeSingle();
  if (perfil.error || perfil.data?.perfil !== 'admin') {
    return { erro: 'Permissão administrativa HML não confirmada.', dados: null };
  }

  const rascunho = await cliente.from('rodizios').select('id,titulo,status,travado')
    .eq('id', RASCUNHO_ID).maybeSingle();
  if (rascunho.error || rascunho.data?.titulo !== 'TESTE FICTICIO RASCUNHO' ||
      rascunho.data.status !== 'rascunho' || rascunho.data.travado !== false) {
    return { erro: 'Fixture de rascunho divergente. Escrita não iniciada.', dados: null };
  }
  const auxiliar = await cliente.from('auxiliares').select('id,nome')
    .eq('id', AUXILIAR_FICTICIA_ID).maybeSingle();
  if (auxiliar.error || auxiliar.data?.nome !== 'TESTE FICTICIO - NAO USAR') {
    return { erro: 'Fixture de Auxiliar divergente. Escrita não iniciada.', dados: null };
  }

  const id = crypto.randomUUID();
  const resultado: Resultado = {
    perfil: 'admin',
    resultado: 'inconclusivo',
    operacao: 'INSERT + DELETE de item fictício em rascunho HML',
    fixtureId: RASCUNHO_ID,
    registroTesteId: id,
    insercao: 'não executada',
    limpeza: 'pendente',
    codigoErro: null,
  };

  try {
    // Não solicitar RETURNING: a prova de INSERT não depende da policy SELECT.
    const insercao = await cliente.from('rodizio_itens').insert({
      id,
      rodizio_id: RASCUNHO_ID,
      data: '2026-12-08',
      porta: 'TESTE HML ESCRITA TEMPORARIA',
      periodo: 'HML',
      auxiliar_id: AUXILIAR_FICTICIA_ID,
      observacoes: 'TESTE HML ESCRITA DESCARTAVEL ' + id,
    });
    resultado.codigoErro = insercao.error?.code ?? null;
    resultado.insercao = insercao.error
      ? 'falhou: ' + insercao.error.message
      : 'INSERT aceito pelo banco';
    resultado.resultado = insercao.error ? 'inconclusivo' : 'aprovado';
  } catch {
    resultado.insercao = 'transporte inconclusivo; verificar eventual INSERT';
  }

  // Limpeza sempre executada, inclusive em falha/transporte incerto.
  // A query seleciona EXCLUSIVAMENTE o UUID gerado nesta chamada.
  try {
    const remocao = await cliente.from('rodizio_itens')
      .delete().eq('id', id).eq('rodizio_id', RASCUNHO_ID).select('id');
    if (remocao.error) {
      resultado.limpeza = 'erro no DELETE: ' + remocao.error.message;
      resultado.resultado = 'inconclusivo';
    } else {
      const removido = remocao.data?.some((linha: { id: string }) => linha.id === id);
      const restante = await cliente.from('rodizio_itens').select('id')
        .eq('id', id).eq('rodizio_id', RASCUNHO_ID);
      if (restante.error) {
        resultado.limpeza = 'consulta posterior falhou: ' + restante.error.message;
        resultado.resultado = 'inconclusivo';
      } else if ((restante.data ?? []).length !== 0) {
        resultado.limpeza = 'ALERTA: registro fictício ainda existe';
        resultado.resultado = 'reprovado';
      } else if (removido) {
        resultado.limpeza = 'confirmada: registro temporário removido';
      } else {
        resultado.limpeza = 'nenhuma linha removida; UUID ausente na verificação posterior';
        if (resultado.resultado === 'aprovado') resultado.resultado = 'inconclusivo';
      }
    }
  } catch {
    resultado.limpeza = 'falha de transporte durante DELETE; revisar UUID';
    resultado.resultado = 'inconclusivo';
  }
  return { erro: null, dados: resultado };
}
