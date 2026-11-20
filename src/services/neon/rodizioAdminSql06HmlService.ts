import { criarClienteNeon } from '../../lib/neon';
import type { ServiceResult } from '../../types/supabase';

// SQL 06: propostas não instaladas na branch Neon. Estes adaptadores
// não são consumidos pela interface operacional e falham fora da HML.
// Não implementar fallback DML ou repetição automática após erro de rede.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SEM_RESPOSTA = 'Resultado indeterminado. Conferir estado e revisão no banco antes de repetir; nenhuma repetição automática.';

type RpcSql06 = 'criar_rodizio_rascunho_versionado'
  | 'atualizar_cabecalho_rascunho_versionado'
  | 'cancelar_rodizio_versionado'
  | 'excluir_rodizio_rascunho_versionado';

function revisarVersao(revisao: number): boolean {
  return Number.isSafeInteger(revisao) && revisao >= 0 &&
    revisao < Number.MAX_SAFE_INTEGER;
}

function intervaloValido(inicio: string, fim: string): boolean {
  if (!DATA.test(inicio) || !DATA.test(fim) || inicio > fim) return false;
  // Date.UTC rejects timezone ambiguity; roundtrip rejects invalid dates.
  const valido = (d: string) => {
    const [ano, mes, dia] = d.split('-').map(Number);
    // Date.UTC(0..99, ...) interpreta o ano como 1900..1999.
    // Construir primeiro e definir o ano integral evita essa coerção.
    if (ano < 1 || ano > 9999 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
      return false;
    }
    const dt = new Date(0);
    dt.setUTCFullYear(ano, mes - 1, dia);
    return dt.toISOString().slice(0, 10) === d;
  };
  return valido(inicio) && valido(fim);
}

async function executarSql06<T>(
  funcao: RpcSql06,
  args: Record<string, unknown>,
  validar: (data: unknown) => T | null,
): Promise<ServiceResult<T>> {
  // Duplo gate: flag isolada + endpoints públicos EXATOS da branch
  // descartável. A build padrão Cloudflare HML usa ep-purple-water e
  // nunca deve executar mutações SQL06, mesmo após uma integração acidental.
  const authEndpoint = 'https://ep-nameless-dust-b6271958.neonauth.c-2.sa-east-1.aws.neon.tech/rodizio_portas/auth';
  const dataEndpoint = 'https://ep-nameless-dust-b6271958.apirest.c-2.sa-east-1.aws.neon.tech/rodizio_portas/rest/v1';
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED !== 'true' ||
      import.meta.env.VITE_NEON_SQL06_ENABLED !== 'true' ||
      import.meta.env.VITE_NEON_AUTH_URL !== authEndpoint ||
      import.meta.env.VITE_NEON_DATA_API_URL !== dataEndpoint) {
    return { data: null, error: 'SQL 06 bloqueada: autorização de teste ou branch Neon descartável não confirmada.' };
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
      return { data: null, error: 'Somente Administrador pode executar esta operação.' };
    }

    // Não buscar a revisão atual antes de gravar. A revisão recebida é a
    // capturada ao abrir o editor, e o servidor faz a checagem sob FOR UPDATE.
    const resposta = await cliente.rpc(funcao, args);
    if (resposta.error) {
      const codigo = resposta.error.code ?? '';
      if (codigo === 'P0001') {
        return { data: null, error: 'Conflito de revisão. Recarregue e revise antes de qualquer nova operação.' };
      }
      if (/^[0-9A-Z]{5}$/.test(codigo)) {
        return { data: null, error: 'Banco recusou a operação (' + codigo + '): ' + resposta.error.message };
      }
      return { data: null, error: SEM_RESPOSTA };
    }
    const resultado = validar(resposta.data);
    if (resultado === null) {
      return { data: null, error: 'Retorno SQL 06 divergente. ' + SEM_RESPOSTA };
    }
    return { data: resultado, error: null };
  } catch {
    return { data: null, error: SEM_RESPOSTA };
  }
}

interface CabecalhoRascunho {
  titulo: string;
  dataInicio: string;
  dataFim: string;
  observacoes?: string | null;
}

function validarCabecalho(input: CabecalhoRascunho): boolean {
  return typeof input.titulo === 'string' &&
    input.titulo.trim().length > 0 && input.titulo.trim().length <= 200 &&
    typeof input.dataInicio === 'string' && typeof input.dataFim === 'string' &&
    intervaloValido(input.dataInicio, input.dataFim) &&
    (input.observacoes == null || typeof input.observacoes === 'string');
}

/**
 * Criação NÃO é idempotente: se o transporte falhar após o COMMIT,
 * um novo clique pode duplicar o rascunho. Reconciliação manual obrigatória.
 */
export function criarRascunhoSql06NeonHml(
  input: CabecalhoRascunho,
): Promise<ServiceResult<string>> {
  if (!validarCabecalho(input)) {
    return Promise.resolve({ data: null, error: 'Título ou intervalo de datas inválido.' });
  }
  return executarSql06('criar_rodizio_rascunho_versionado', {
    p_titulo: input.titulo.trim(),
    p_data_inicio: input.dataInicio,
    p_data_fim: input.dataFim,
    p_observacoes: input.observacoes ?? null,
  }, value => typeof value === 'string' && UUID.test(value) ? value : null);
}

export function atualizarCabecalhoRascunhoSql06NeonHml(
  id: string,
  revisaoOriginal: number,
  input: CabecalhoRascunho,
): Promise<ServiceResult<number>> {
  if (!UUID.test(id) || !revisarVersao(revisaoOriginal) || !validarCabecalho(input)) {
    return Promise.resolve({ data: null, error: 'Escala, revisão ou cabeçalho inválidos.' });
  }
  return executarSql06('atualizar_cabecalho_rascunho_versionado', {
    p_rodizio_id: id,
    p_revisao_esperada: revisaoOriginal,
    p_titulo: input.titulo.trim(),
    p_data_inicio: input.dataInicio,
    p_data_fim: input.dataFim,
    p_observacoes: input.observacoes ?? null,
  }, value => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n === revisaoOriginal + 1 ? n : null;
  });
}

export function cancelarRodizioSql06NeonHml(
  id: string,
  revisaoOriginal: number,
): Promise<ServiceResult<number>> {
  if (!UUID.test(id) || !revisarVersao(revisaoOriginal)) {
    return Promise.resolve({ data: null, error: 'Escala ou revisão original inválida.' });
  }
  return executarSql06('cancelar_rodizio_versionado', {
    p_rodizio_id: id,
    p_revisao_esperada: revisaoOriginal,
  }, value => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n === revisaoOriginal + 1 ? n : null;
  });
}

export function excluirRascunhoSql06NeonHml(
  id: string,
  revisaoOriginal: number,
): Promise<ServiceResult<boolean>> {
  if (!UUID.test(id) || !revisarVersao(revisaoOriginal)) {
    return Promise.resolve({ data: null, error: 'Escala ou revisão original inválida.' });
  }
  return executarSql06('excluir_rodizio_rascunho_versionado', {
    p_rodizio_id: id,
    p_revisao_esperada: revisaoOriginal,
  }, value => value === true ? true : null);
}
