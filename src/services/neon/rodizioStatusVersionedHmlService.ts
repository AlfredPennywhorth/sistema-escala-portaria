import { criarClienteNeon } from '../../lib/neon';
import type { ServiceResult } from '../../types/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Transicao = 'publicar' | 'travar';

/**
 * Adaptador isolado para a proposta SQL 05. NENHUMA tela operacional
 * consome estas operações até homologação real na branch descartável.
 * A revisão deve ser a do snapshot original da tela, não um refetch.
 */
async function transicaoVersionadaHml(
  transicao: Transicao,
  rodizioId: string,
  revisaoOriginal: number,
): Promise<ServiceResult<number>> {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { data: null, error: 'Transições Neon permitidas somente em homologação.' };
  }
  if (!UUID.test(rodizioId) || !Number.isSafeInteger(revisaoOriginal) ||
      revisaoOriginal < 0 || revisaoOriginal >= Number.MAX_SAFE_INTEGER) {
    return { data: null, error: 'Escala ou revisão original inválida.' };
  }

  try {
    const cliente = criarClienteNeon();
    const sessao = await cliente.auth.getSession();
    if (sessao.error) return { data: null, error: sessao.error.message };
    const usuario = sessao.data.session?.user;
    if (!usuario) return { data: null, error: 'JWT obrigatório.' };

    const perfil = await cliente.from('usuarios_auxiliares')
      .select('perfil').eq('user_id', usuario.id).maybeSingle();
    if (perfil.error) return { data: null, error: perfil.error.message };
    if (perfil.data?.perfil !== 'admin') {
      return { data: null, error: 'Somente Administrador pode alterar o estado da escala.' };
    }

    // A autorização definitiva ocorre na RPC SECURITY INVOKER e na RLS.
    // Não buscar a revisão mais recente antes do POST: esconderia conflitos.
    const funcao = transicao === 'publicar'
      ? 'publicar_rodizio_versionado'
      : 'travar_rodizio_versionado';
    const resposta = await cliente.rpc(funcao, {
      p_rodizio_id: rodizioId,
      p_revisao_esperada: revisaoOriginal,
    });
    if (resposta.error) {
      if (resposta.error.code === 'P0001') {
        return {
          data: null,
          error: 'Conflito de revisão: a escala mudou desde a abertura. Recarregue e confirme antes de agir.',
        };
      }
      const codigo = resposta.error.code ?? '';
      if (/^[0-9A-Z]{5}$/.test(codigo)) {
        return { data: null, error: 'Banco recusou a transição (' + codigo + '): ' + resposta.error.message };
      }
      return {
        data: null,
        error: 'Resposta indeterminada. Confira estado e revisão no banco antes de repetir a transição.',
      };
    }

    // bigint SQL pode ser serializado como número ou texto pela Data API.
    const novaRevisao = Number(resposta.data);
    if (!Number.isSafeInteger(novaRevisao) || novaRevisao !== revisaoOriginal + 1) {
      return {
        data: null,
        error: 'Resposta de revisão divergente. Conferir o banco antes de qualquer repetição.',
      };
    }
    return { data: novaRevisao, error: null };
  } catch {
    return {
      data: null,
      error: 'Falha de transporte com resultado indeterminado; reconciliar antes de repetir.',
    };
  }
}

export function publicarRodizioVersionadoNeonHml(
  rodizioId: string, revisaoOriginal: number,
): Promise<ServiceResult<number>> {
  return transicaoVersionadaHml('publicar', rodizioId, revisaoOriginal);
}

export function travarRodizioVersionadoNeonHml(
  rodizioId: string, revisaoOriginal: number,
): Promise<ServiceResult<number>> {
  return transicaoVersionadaHml('travar', rodizioId, revisaoOriginal);
}
