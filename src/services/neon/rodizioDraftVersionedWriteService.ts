import { criarClienteNeon } from '../../lib/neon';
import type { RodizioItemInput, ServiceResult } from '../../types/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Somente homologação Neon, nunca chamado pelo runtime Supabase.
 * A revisão esperada DEVE vir do snapshot que abriu o editor.
 * Não recarregar a revisão imediatamente antes de salvar (perderia o conflito).
 */
export async function substituirItensRascunhoVersionadosNeonHml(
  rodizioId: string,
  itens: RodizioItemInput[],
  revisaoEsperada: number,
): Promise<ServiceResult<number>> {
  // Escrita habilitada exclusivamente em build autorizada da branch descartável.
  const authEndpoint = 'https://ep-nameless-dust-b6271958.neonauth.c-2.sa-east-1.aws.neon.tech/rodizio_portas/auth';
  const dataEndpoint = 'https://ep-nameless-dust-b6271958.apirest.c-2.sa-east-1.aws.neon.tech/rodizio_portas/rest/v1';
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true' ||
      import.meta.env.VITE_NEON_SQL06_ENABLED !== 'true' ||
      import.meta.env.VITE_NEON_AUTH_URL !== authEndpoint ||
      import.meta.env.VITE_NEON_DATA_API_URL !== dataEndpoint) {
    return { data: null, error: 'Gravação bloqueada: autorização e branch descartável não confirmadas.' };
  }
  if (!UUID.test(rodizioId)) {
    return { data: null, error: 'ID da escala inválido.' };
  }
  if (!Number.isSafeInteger(revisaoEsperada) || revisaoEsperada < 0) {
    return { data: null, error: 'Revisão original da escala é obrigatória.' };
  }
  if (!Array.isArray(itens) || itens.length < 1 || itens.length > 500) {
    return { data: null, error: 'Informe de 1 a 500 itens.' };
  }
  for (const item of itens) {
    if (!item || typeof item.data !== 'string' || !DATA.test(item.data) ||
        typeof item.porta !== 'string' || !item.porta.trim() ||
        (item.auxiliar_id != null && !UUID.test(item.auxiliar_id)) ||
        (item.periodo != null && typeof item.periodo !== 'string') ||
        (item.observacoes != null && typeof item.observacoes !== 'string')) {
      return { data: null, error: 'Item inválido: verifique data, porta, auxiliar e textos.' };
    }
  }

  try {
    const cliente = criarClienteNeon();
    const sessao = await cliente.auth.getSession();
    if (sessao.error) return { data: null, error: sessao.error.message };
    const usuario = sessao.data.session?.user;
    if (!usuario) return { data: null, error: 'JWT obrigatório.' };
    const vinculo = await cliente.from('usuarios_auxiliares')
      .select('perfil').eq('user_id', usuario.id).maybeSingle();
    if (vinculo.error) return { data: null, error: vinculo.error.message };
    if (vinculo.data?.perfil !== 'admin') {
      return { data: null, error: 'Somente Administrador pode substituir rascunhos.' };
    }

    // Não consultar a revisão atual aqui: a função SQL valida a versão
    // enviada pelo editor sob o FOR UPDATE da mesma transação.
    const resposta = await cliente.rpc('substituir_itens_rodizio_rascunho_versionado', {
      p_rodizio_id: rodizioId,
      p_itens: itens.map(item => ({
        data: item.data,
        porta: item.porta.trim(),
        periodo: item.periodo ?? null,
        auxiliar_id: item.auxiliar_id ?? null,
        observacoes: item.observacoes ?? null,
      })),
      p_revisao_esperada: revisaoEsperada,
    });

    if (resposta.error) {
      if (resposta.error.code === 'P0001') {
        return { data: null, error: 'Conflito de edição: outro administrador alterou esta escala. Recarregue e revise as diferenças antes de salvar novamente.' };
      }
      const codigo = resposta.error.code ?? '';
      if (/^[0-9A-Z]{5}$/.test(codigo)) {
        return { data: null, error: 'Banco recusou a operação (' + codigo + '): ' + resposta.error.message };
      }
      return {
        data: null,
        error: 'Resultado indeterminado da RPC (' + (codigo || 'sem SQLSTATE') + '). Confira revisão e itens no Neon antes de repetir.',
      };
    }

    if (typeof resposta.data !== 'number' || resposta.data !== itens.length) {
      return { data: null, error: 'Retorno divergente da RPC. Conferir estado do banco antes de qualquer repetição.' };
    }
    return { data: resposta.data, error: null };
  } catch {
    return { data: null, error: 'Resposta indeterminada da RPC: reconcilie a escala no banco antes de repetir.' };
  }
}
