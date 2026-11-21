import { criarClienteNeon } from '../../lib/neon';
import type { RodizioItemInput, ServiceResult } from '../../types/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Adaptador isolado para a RPC proposta em
 * migration/neon/03_atomic_draft_items_PROPOSAL.sql.
 *
 * A funcao SQL ainda NAO foi implantada. Não ligar ao fluxo principal nem
 * chamar no ambiente real antes de gate de aplicacao, JWT e rollback.
 * Nunca fazer fallback para DELETE + INSERT em requisicoes separadas.
 */
export async function substituirItensRascunhoNeonHml(
  rodizioId: string,
  itens: RodizioItemInput[],
): Promise<ServiceResult<number>> {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { data: null, error: 'Escrita Neon disponivel apenas na homologacao isolada.' };
  }

  if (!UUID.test(rodizioId)) {
    return { data: null, error: 'ID de rodizio invalido.' };
  }
  if (!Array.isArray(itens) || itens.length < 1 || itens.length > 500) {
    return { data: null, error: 'Informe entre 1 e 500 itens.' };
  }

  for (const item of itens) {
    if (!item || typeof item !== 'object' ||
        typeof item.data !== 'string' || !DATA.test(item.data) ||
        typeof item.porta !== 'string' || !item.porta.trim()) {
      return { data: null, error: 'Data e porta validas sao obrigatorias em cada item.' };
    }
    if (item.auxiliar_id != null && !UUID.test(item.auxiliar_id)) {
      return { data: null, error: 'ID de auxiliar invalido.' };
    }
    if (item.periodo != null && typeof item.periodo !== 'string') {
      return { data: null, error: 'Periodo invalido.' };
    }
    if (item.observacoes != null && typeof item.observacoes !== 'string') {
      return { data: null, error: 'Observacoes invalidas.' };
    }
  }

  try {
    const cliente = criarClienteNeon();
    const { data: sessao, error: erroSessao } = await cliente.auth.getSession();
    if (erroSessao) return { data: null, error: erroSessao.message };
    const usuario = sessao.session?.user;
    if (!usuario) return { data: null, error: 'Sessao autenticada obrigatoria.' };

    // A checagem no cliente melhora o diagnostico; autorizacao definitiva
    // continua no SECURITY INVOKER/RLS da RPC (sem service role).
    const { data: vinculo, error: erroPerfil } = await cliente.from('usuarios_auxiliares')
      .select('perfil').eq('user_id', usuario.id).maybeSingle();
    if (erroPerfil) return { data: null, error: erroPerfil.message };
    if (vinculo?.perfil !== 'admin') {
      return { data: null, error: 'Somente Administrador pode substituir itens.' };
    }

    // Nao executar se o estado da escala nao for rascunho. A RPC faz
    // a mesma verificacao sob SELECT ... FOR UPDATE, antes do DELETE.
    const { data: escala, error: erroEscala } = await cliente.from('rodizios')
      .select('id,status,travado').eq('id', rodizioId).maybeSingle();
    if (erroEscala) return { data: null, error: erroEscala.message };
    if (!escala || escala.status !== 'rascunho' || escala.travado !== false) {
      return { data: null, error: 'Somente escala em rascunho nao travada.' };
    }

    // Esta chamada existe apenas como adaptador ainda nao vinculado a UI.
    // Nao fazer DELETE + INSERT como recuperacao se a RPC nao existir.
    const { data, error } = await cliente.rpc('substituir_itens_rodizio_rascunho', {
      p_rodizio_id: rodizioId,
      p_itens: itens.map((item) => ({
        data: item.data,
        porta: item.porta.trim(),
        periodo: item.periodo ?? null,
        auxiliar_id: item.auxiliar_id ?? null,
        observacoes: item.observacoes ?? null,
      })),
    });
    if (error) {
      // SQLSTATE retornado pelo PostgreSQL representa negativa do banco
      // com rollback. Transporte/gateway sem SQLSTATE nao comprova commit.
      const codigo = error.code ?? '';
      if (/^[0-9A-Z]{5}$/.test(codigo)) {
        return {
          data: null,
          error: 'RPC rejeitada pelo banco (' + codigo + '): ' + error.message,
        };
      }
      return {
        data: null,
        error: 'Resultado indeterminado da RPC (' + (codigo || 'sem SQLSTATE') +
          '): ' + error.message +
          '. Verifique os itens no banco antes de repetir a gravacao.',
      };
    }
    if (typeof data !== 'number' || data !== itens.length) {
      return { data: null, error: 'Resposta da RPC divergente; nao repetir a operacao sem verificacao do banco.' };
    }
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: 'Falha indeterminada na RPC. Verifique o banco antes de repetir a chamada.',
    };
  }
}
