import { criarClienteNeon } from '../../lib/neon';
import type { ServiceResult } from '../../types/supabase';

// Fixtures exclusivamente fictícias da branch de homologação.
// Não usar para consulta de dados reais nem no runtime de produção.
const RODIZIO_PUBLICADO = '00000000-0000-4000-8000-000000000203';
const RODIZIO_RASCUNHO = '00000000-0000-4000-8000-000000000202';
const LIMITE_POR_CONSULTA = 100;

interface ResumoCatalogo {
  perfil: string;
  auxiliaresVisiveis: number;
  auxiliaresAtivasVisiveis: number;
  restricoesVisiveis: number;
  restricoesAtivasVisiveis: number;
  rodizioPublicadoVisivel: boolean;
  itensRodizioPublicadoVisiveis: number;
  rodizioRascunhoVisivel: boolean;
  itensRodizioRascunhoVisiveis: number;
  limitado: boolean;
  restricoesSemFixtureNaoComprovamNegativa: boolean;
  somenteLeitura: true;
}

async function verificarSessaoHomologacao(): Promise<ServiceResult<{ userId: string; perfil: string }>> {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true') {
    return { data: null, error: 'Leitura de catálogo Neon restrita à homologação.' };
  }
  try {
    const cliente = criarClienteNeon();
    const sessao = await cliente.auth.getSession();
    if (sessao.error) return { data: null, error: sessao.error.message };
    const id = sessao.data.session?.user?.id;
    if (!id) return { data: null, error: 'Sessão autenticada obrigatória.' };
    const perfil = await cliente.from('usuarios_auxiliares').select('perfil')
      .eq('user_id', id).maybeSingle();
    if (perfil.error) return { data: null, error: perfil.error.message };
    if (!perfil.data?.perfil) return { data: null, error: 'Conta sem vínculo de perfil em homologação.' };
    return { data: { userId: id, perfil: perfil.data.perfil }, error: null };
  } catch {
    return { data: null, error: 'Não foi possível verificar o perfil Neon.' };
  }
}

/**
 * Compara leituras SELECT com o JWT real da sessão, sem nomes, contatos
 * ou dados privados no resumo. É um teste de visibilidade, não prova
 * independente das policies para casos sem fixture ou sem dados.
 */
export async function verificarCatalogosNeon(): Promise<{ dados: ResumoCatalogo | null; erro: string | null }> {
  const sessao = await verificarSessaoHomologacao();
  if (sessao.error) return { dados: null, erro: sessao.error };
  try {
    const cliente = criarClienteNeon();
    const auxiliares = await cliente.from('auxiliares')
      .select('id,ativa').order('id', { ascending: true }).limit(LIMITE_POR_CONSULTA);
    if (auxiliares.error) return { dados: null, erro: auxiliares.error.message };

    const restricoes = await cliente.from('restricoes_auxiliares')
      .select('id,ativa').order('id', { ascending: true }).limit(LIMITE_POR_CONSULTA);
    if (restricoes.error) return { dados: null, erro: restricoes.error.message };

    const publicado = await cliente.from('rodizios').select('id,status')
      .eq('id', RODIZIO_PUBLICADO).maybeSingle();
    if (publicado.error) return { dados: null, erro: publicado.error.message };
    const rascunho = await cliente.from('rodizios').select('id,status')
      .eq('id', RODIZIO_RASCUNHO).maybeSingle();
    if (rascunho.error) return { dados: null, erro: rascunho.error.message };

    // As policies SELECT de rodizios e rodizio_itens são independentes.
    // Consultar ambas as fixtures diretamente, ainda que o rodízio pai
    // esteja invisível, para detectar uma eventual exposição indevida.
    const itensPublicadosResultado = await cliente.from('rodizio_itens')
      .select('id').eq('rodizio_id', RODIZIO_PUBLICADO)
      .order('id', { ascending: true }).limit(LIMITE_POR_CONSULTA);
    if (itensPublicadosResultado.error) {
      return { dados: null, erro: itensPublicadosResultado.error.message };
    }
    const itensRascunhoResultado = await cliente.from('rodizio_itens')
      .select('id').eq('rodizio_id', RODIZIO_RASCUNHO)
      .order('id', { ascending: true }).limit(LIMITE_POR_CONSULTA);
    if (itensRascunhoResultado.error) {
      return { dados: null, erro: itensRascunhoResultado.error.message };
    }
    const itensPublicados = (itensPublicadosResultado.data ?? []) as Array<{ id: string }>;
    const itensRascunho = (itensRascunhoResultado.data ?? []) as Array<{ id: string }>;

    const aux = (auxiliares.data ?? []) as Array<{ id: string; ativa: boolean }>;
    const restr = (restricoes.data ?? []) as Array<{ id: string; ativa: boolean }>;
    const limitado = [aux.length, restr.length, itensPublicados.length, itensRascunho.length]
      .some((total) => total >= LIMITE_POR_CONSULTA);
    return {
      erro: null,
      dados: {
        perfil: sessao.data!.perfil,
        auxiliaresVisiveis: aux.length,
        auxiliaresAtivasVisiveis: aux.filter((v) => v.ativa).length,
        restricoesVisiveis: restr.length,
        restricoesAtivasVisiveis: restr.filter((v) => v.ativa).length,
        rodizioPublicadoVisivel: publicado.data?.status === 'publicado',
        itensRodizioPublicadoVisiveis: itensPublicados.length,
        rodizioRascunhoVisivel: rascunho.data?.status === 'rascunho',
        itensRodizioRascunhoVisiveis: itensRascunho.length,
        limitado,
        restricoesSemFixtureNaoComprovamNegativa: restr.length === 0,
        somenteLeitura: true,
      },
    };
  } catch {
    return { dados: null, erro: 'Falha nas consultas de catálogo Neon.' };
  }
}
