import { criarClienteNeon } from '../../lib/neon';
import type { Auxiliar, Rodizio, RodizioItem, ServiceResult } from '../../types/supabase';

/**
 * Primeira etapa da migração funcional: consultas isoladas com Neon Data API
 * e JWT real. Não altera os serviços Supabase ainda usados na aplicação.
 * O banco aplica as policies RLS; esta camada não usa chave administrativa.
 */
async function sessaoObrigatoria(): Promise<ServiceResult<{ userId: string }>> {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { data: null, error: 'Leituras Neon restritas à homologação.' };
  }
  try {
    const { data, error } = await criarClienteNeon().auth.getSession();
    if (error) return { data: null, error: error.message };
    if (!data.session?.user?.id) return { data: null, error: 'Sessão autenticada obrigatória.' };
    return { data: { userId: data.session.user.id }, error: null };
  } catch {
    return { data: null, error: 'Falha ao consultar sessão Neon.' };
  }
}

export async function listarEscalasVisiveisNeon(): Promise<ServiceResult<Rodizio[]>> {
  const sessao = await sessaoObrigatoria();
  if (sessao.error) return { data: null, error: sessao.error };
  try {
    const { data, error } = await criarClienteNeon().from('rodizios')
      .select('id,titulo,data_inicio,data_fim,status,travado,travado_em,observacoes,created_at')
      .order('data_inicio', { ascending: false }).limit(100);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as Rodizio[], error: null };
  } catch {
    return { data: null, error: 'Falha ao listar escalas Neon.' };
  }
}

export async function obterMinhaAuxiliarNeon(): Promise<ServiceResult<Auxiliar | null>> {
  const sessao = await sessaoObrigatoria();
  if (sessao.error) return { data: null, error: sessao.error };
  try {
    const cliente = criarClienteNeon();
    const { data: vinculo, error: erroVinculo } = await cliente
      .from('usuarios_auxiliares').select('auxiliar_id')
      .eq('user_id', sessao.data.userId).maybeSingle();
    if (erroVinculo) return { data: null, error: erroVinculo.message };
    if (!vinculo?.auxiliar_id) return { data: null, error: null };
    const { data, error } = await cliente.from('auxiliares')
      .select('id,nome,telefone,email,ativa,observacoes,created_at')
      .eq('id', vinculo.auxiliar_id).maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: (data as Auxiliar | null) ?? null, error: null };
  } catch {
    return { data: null, error: 'Falha ao consultar vínculo da auxiliar Neon.' };
  }
}

export async function listarMinhasDatasNeon(): Promise<ServiceResult<RodizioItem[]>> {
  const sessao = await sessaoObrigatoria();
  if (sessao.error) return { data: null, error: sessao.error };
  const minha = await obterMinhaAuxiliarNeon();
  if (minha.error) return { data: null, error: minha.error };
  if (!minha.data) return { data: [], error: null };
  try {
    const cliente = criarClienteNeon();
    // Buscar os itens da própria auxiliar PRIMEIRO, sem pré-limitar rodízios.
    // Paginar por data+id estável para que uma escala antiga não desapareça
    // quando existirem mais de 100 rodízios ou rascunhos recentes.
    const tamanhoPagina = 100;
    const limiteResultado = 100;
    const encontrados: RodizioItem[] = [];
    let inicio = 0;

    while (encontrados.length < limiteResultado) {
      const { data: itens, error: erroItens } = await cliente.from('rodizio_itens')
        .select('id,rodizio_id,data,porta,periodo,auxiliar_id,observacoes,created_at')
        .eq('auxiliar_id', minha.data.id)
        .order('data', { ascending: true })
        .order('id', { ascending: true })
        .range(inicio, inicio + tamanhoPagina - 1);
      if (erroItens) return { data: null, error: erroItens.message };
      const pagina = (itens ?? []) as RodizioItem[];
      if (!pagina.length) break;

      // RLS também se aplica à leitura dos rodízios. Validar status para
      // cada página antes de limitar a lista final de datas.
      const ids = [...new Set(pagina.map((item) => item.rodizio_id))];
      const { data: escalas, error: erroEscalas } = await cliente.from('rodizios')
        .select('id,status')
        .in('id', ids)
        .in('status', ['publicado', 'travado']);
      if (erroEscalas) return { data: null, error: erroEscalas.message };
      const permitidos = new Set((escalas ?? []).map((escala) => escala.id));
      for (const item of pagina) {
        if (permitidos.has(item.rodizio_id)) {
          encontrados.push(item);
          if (encontrados.length === limiteResultado) break;
        }
      }
      if (pagina.length < tamanhoPagina) break;
      inicio += tamanhoPagina;
    }
    return { data: encontrados, error: null };
  } catch {
    return { data: null, error: 'Falha ao consultar datas da auxiliar Neon.' };
  }
}

/** Resumo de homologação, sem nomes, telefones ou outros dados pessoais. */
export async function verificarLeiturasFuncionaisNeon() {
  const escalas = await listarEscalasVisiveisNeon();
  if (escalas.error) return { erro: escalas.error, dados: null };
  const minha = await obterMinhaAuxiliarNeon();
  if (minha.error) return { erro: minha.error, dados: null };
  const datas = await listarMinhasDatasNeon();
  if (datas.error) return { erro: datas.error, dados: null };
  return {
    erro: null,
    dados: {
      escalasVisiveis: escalas.data.length,
      statusVisiveis: escalas.data.map((r) => r.status),
      auxiliarPessoalVinculada: Boolean(minha.data),
      datasPropriasPublicadasOuTravadas: datas.data.length,
      limiteDatasExibidas: 100,
      dadosPodemEstarLimitados: datas.data.length === 100,
      leituraSomente: true,
    },
  };
}
