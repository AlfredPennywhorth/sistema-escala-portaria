import { criarClienteNeon } from '../../lib/neon';
import { substituirItensRascunhoVersionadosNeonHml } from './rodizioDraftVersionedWriteService';
import type { Rodizio, RodizioComItens, RodizioItem, RodizioItemInput, ServiceResult } from '../../types/supabase';

const MAX_ITENS_LEITURA = 500;
const MAX_RODIZIOS_LEITURA = 100;

function permitidoHml(): boolean {
  return import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED === 'true';
}

async function exigirAdministrador(): Promise<ServiceResult<true>> {
  if (!permitidoHml()) {
    return { data: null, error: 'Funcionalidade disponível somente na homologação isolada Neon.' };
  }
  const cliente = criarClienteNeon();
  const sessao = await cliente.auth.getSession();
  if (sessao.error) return { data: null, error: sessao.error.message };
  const usuario = sessao.data.session?.user;
  if (!usuario) return { data: null, error: 'Sessão autenticada obrigatória.' };

  const { data: vinculo, error } = await cliente.from('usuarios_auxiliares')
    .select('perfil').eq('user_id', usuario.id).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (vinculo?.perfil !== 'admin') {
    return { data: null, error: 'Operação disponível apenas para Administrador.' };
  }
  return { data: true, error: null };
}

/** Preparação da migração: leitura por Neon Auth / RLS; NÃO alterar telas produtivas. */
export async function listarRodiziosAdministrativosNeonHml(): Promise<ServiceResult<Rodizio[]>> {
  try {
    const acesso = await exigirAdministrador();
    if (acesso.error) return { data: null, error: acesso.error };
    const cliente = criarClienteNeon();
    const { data, error } = await cliente.from('rodizios')
      .select('*')
      .order('data_inicio', { ascending: false })
      .order('id', { ascending: true })
      .limit(MAX_RODIZIOS_LEITURA + 1);
    if (error) return { data: null, error: error.message };
    if ((data ?? []).length > MAX_RODIZIOS_LEITURA) {
      return {
        data: null,
        error: 'Listagem administrativa excedeu 100 escalas; paginação obrigatória antes da integração.',
      };
    }
    return { data: (data ?? []) as Rodizio[], error: null };
  } catch {
    return { data: null, error: 'Falha na leitura administrativa Neon HML.' };
  }
}

export async function obterRodizioComItensNeonHml(
  rodizioId: string,
): Promise<ServiceResult<RodizioComItens | null>> {
  try {
    const acesso = await exigirAdministrador();
    if (acesso.error) return { data: null, error: acesso.error };
    const cliente = criarClienteNeon();
    const cabecalho = await cliente.from('rodizios').select('*')
      .eq('id', rodizioId).maybeSingle();
    if (cabecalho.error) return { data: null, error: cabecalho.error.message };
    if (!cabecalho.data) return { data: null, error: 'Escala não encontrada ou inacessível.' };

    const resultado = await cliente.from('rodizio_itens').select('*')
      .eq('rodizio_id', rodizioId)
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .limit(MAX_ITENS_LEITURA + 1);
    if (resultado.error) return { data: null, error: resultado.error.message };
    if ((resultado.data ?? []).length > MAX_ITENS_LEITURA) {
      return { data: null, error: 'Mais de 500 itens: evitar leitura truncada sem paginação.' };
    }

    // Leituras REST separadas não compartilham um snapshot transacional.
    // Ler a revisão novamente detecta gravação concluída entre cabeçalho
    // e itens, impedindo devolver um objeto misturado ou confirmar escrita
    // baseada em contagem coincidente. Não substituir o cabecalho antigo.
    const confirmacao = await cliente.from('rodizios')
      .select('id,revisao,status,travado')
      .eq('id', rodizioId).maybeSingle();
    if (confirmacao.error) return { data: null, error: confirmacao.error.message };
    if (!confirmacao.data) {
      return { data: null, error: 'Escala indisponível durante a leitura; consultar novamente.' };
    }
    const revisaoInicial = (cabecalho.data as Rodizio & { revisao?: number | string }).revisao;
    if (revisaoInicial == null ||
        confirmacao.data.revisao == null ||
        String(revisaoInicial) !== String(confirmacao.data.revisao) ||
        cabecalho.data.status !== confirmacao.data.status ||
        cabecalho.data.travado !== confirmacao.data.travado) {
      return {
        data: null,
        error: 'Escala alterada durante a leitura. Descartar os dados misturados e recarregar; nenhuma repetição automática.',
      };
    }

    return {
      data: {
        rodizio: cabecalho.data as Rodizio,
        itens: (resultado.data ?? []) as RodizioItem[],
      },
      error: null,
    };
  } catch {
    return { data: null, error: 'Falha ao obter itens do rodízio Neon HML.' };
  }
}

/**
 * Único caminho planejado para salvar rascunhos no Neon:
 * - senha e JWT nunca trafegam pelo serviço;
 * - validação e SELECT de estado são auxiliares, segurança real é no banco;
 * - revisão original obrigatória e validada sob lock; nunca atualizar
 *   silenciosamente a revisão do editor;
 * - operação atômica via RPC versionada; não fazer DELETE seguido de INSERT;
 * - se falhar ou a resposta for incerta, o chamador deve reconciliar
 *   o estado com nova consulta, jamais repetir automaticamente.
 *
 * Este serviço NÃO está ligado ao fluxo operacional/produção.
 * A RPC está aplicada apenas na branch descartável de testes, não na HML principal.
 */
export async function salvarRascunhoAtomicoNeonHml(
  rodizioId: string,
  itens: RodizioItemInput[],
  revisaoOriginal: number,
): Promise<ServiceResult<RodizioComItens>> {
  const acesso = await exigirAdministrador();
  if (acesso.error) return { data: null, error: acesso.error };
  if (!Number.isSafeInteger(revisaoOriginal) || revisaoOriginal < 0 || revisaoOriginal >= Number.MAX_SAFE_INTEGER) {
    return { data: null, error: 'Revisão original inválida ou ausente.' };
  }
  const anterior = await obterRodizioComItensNeonHml(rodizioId);
  if (anterior.error) return { data: null, error: anterior.error };
  if (!anterior.data || anterior.data.rodizio.status !== 'rascunho' ||
      anterior.data.rodizio.travado !== false) {
    return { data: null, error: 'Somente rascunhos não travados podem ser substituídos.' };
  }

  // revisaoOriginal foi capturada ao abrir o editor; nunca substituí-la
  // por uma revisão fresca buscada neste método.
  const escrita = await substituirItensRascunhoVersionadosNeonHml(rodizioId, itens, revisaoOriginal);
  if (escrita.error) {
    return {
      data: null,
      error: escrita.error + ' Nenhuma repetição automática foi executada.',
    };
  }

  const posterior = await obterRodizioComItensNeonHml(rodizioId);
  if (posterior.error || !posterior.data) {
    return {
      data: null,
      error: 'RPC retornou sucesso, mas a reconciliação falhou. Consultar o banco antes de repetir: ' +
        (posterior.error || 'escala inacessível'),
    };
  }
  const revisaoPosterior = (posterior.data.rodizio as Rodizio & { revisao?: number | string }).revisao;
  // A comparação de quantidade, sozinha, aceita um N+2 com o mesmo número
  // de linhas. Validar revisão e conteúdo esperado, sem confiar em IDs novos.
  const chave = (item: RodizioItemInput) => JSON.stringify([
    item.data.slice(0, 10), item.porta.trim(), item.periodo || null,
    item.auxiliar_id || null, item.observacoes ?? null,
  ]);
  const esperados = itens.map(chave).sort();
  const encontrados = posterior.data.itens.map(item => chave(item)).sort();
  if (String(revisaoPosterior) !== String(revisaoOriginal + 1) ||
      esperados.length !== encontrados.length ||
      esperados.some((item, i) => item !== encontrados[i])) {
    return {
      data: null,
      error: 'Reconciliação divergente (revisão ou conteúdo): outro escritor pode ter alterado a escala. Não repetir; conferir banco.',
    };
  }
  return { data: posterior.data, error: null };
}
