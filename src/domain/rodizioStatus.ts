import type { Rodizio } from '../types/supabase';

export function isRodizioTravado(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.travado === true;
}

export function isRodizioRascunho(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.status === 'rascunho';
}

export function isRodizioPublicado(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.status === 'publicado';
}

export function isRodizioCancelado(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.status === 'cancelado';
}

export function podeEditarRodizio(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.travado === false;
}

export function podeExcluirRodizio(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.status === 'rascunho' && rodizio.travado === false;
}

export function podePublicarRodizio(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.status === 'rascunho' && rodizio.travado === false;
}

export function podeTravarRodizio(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return (rodizio.status === 'rascunho' || rodizio.status === 'publicado')
    && rodizio.travado === false;
}

export function podeCancelarRodizio(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.status === 'rascunho'
    && rodizio.travado === false;
}

export function podeSalvarItensRodizio(rodizio: Rodizio | null | undefined): boolean {
  if (!rodizio) return false;
  return rodizio.travado === false;
}

export function getStatusLabel(rodizio: Rodizio | null | undefined): string {
  if (!rodizio) return 'Desconhecido';

  switch (rodizio.status) {
    case 'rascunho':
      return 'Rascunho';
    case 'publicado':
      return 'Publicado';
    case 'travado':
      return 'Travado';
    case 'cancelado':
      return 'Cancelado';
    default:
      return 'Desconhecido';
  }
}

export function getMensagemBloqueioRodizio(
  rodizio: Rodizio | null | undefined,
  acao?: string
): string | null {
  if (!rodizio) {
    return 'Rodízio não encontrado';
  }

  if (acao === 'editar') {
    if (isRodizioTravado(rodizio)) {
      return 'Este rodízio está travado e não pode ser editado. Ele serve como histórico para equilíbrio das próximas escalas.';
    }
    return null;
  }

  if (acao === 'excluir') {
    if (isRodizioTravado(rodizio)) {
      return 'Este rodízio está travado e não pode ser excluído.';
    }
    if (!isRodizioRascunho(rodizio)) {
      return 'Apenas rodízios em rascunho podem ser excluídos.';
    }
    return null;
  }

  if (acao === 'publicar') {
    if (isRodizioTravado(rodizio)) {
      return 'Este rodízio está travado e não pode ser publicado.';
    }
    if (!isRodizioRascunho(rodizio)) {
      return 'Apenas rodízios em rascunho podem ser publicados.';
    }
    return null;
  }

  if (acao === 'travar') {
    if (isRodizioTravado(rodizio)) {
      return 'Este rodízio já está travado.';
    }
    if (isRodizioCancelado(rodizio)) {
      return 'Rodízios cancelados não podem ser travados.';
    }
    return null;
  }

  if (acao === 'cancelar') {
    if (isRodizioTravado(rodizio)) {
      return 'Este rodízio está travado e não pode ser cancelado.';
    }
    if (isRodizioCancelado(rodizio)) {
      return 'Este rodízio já está cancelado.';
    }
    return null;
  }

  if (acao === 'salvar-itens') {
    if (isRodizioTravado(rodizio)) {
      return 'Este rodízio está travado e seus itens não podem ser alterados.';
    }
    return null;
  }

  return null;
}

export function getMensagemHistorico(): string {
  return 'Rodízio travado — usado como histórico para equilíbrio das próximas escalas';
}

export function getCorStatus(rodizio: Rodizio | null | undefined): 'gray' | 'blue' | 'green' | 'yellow' | 'red' {
  if (!rodizio) return 'gray';

  switch (rodizio.status) {
    case 'rascunho':
      return 'gray';
    case 'publicado':
      return 'blue';
    case 'travado':
      return 'green';
    case 'cancelado':
      return 'red';
    default:
      return 'gray';
  }
}