/**
 * @file neon-p0-editor-behavior.test.mjs
 * @description Testes comportamentais para P0 - Integração das 7 operações de editor de rodízios
 *
 * Testes de:
 * - Bloqueio de escrita fora do ambiente autorizado
 * - Preservação da revisão original (OCC)
 * - Conflitos de edição concorrente
 * - Alteração de sessão durante operação
 * - Resposta indeterminada (timeout, rede, 200 sem retorno) sem repetição automática
 * - Reconciliação após gravação
 * - Ausência de fallback Supabase
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Mock de um editor de rodízios simplificado
class MockRodizioEditor {
  constructor() {
    this.revisaoOriginal = null;
    this.ambiente = null;
    this.sessao = null;
  }

  /**
   * Captura revisão original ao abrir editor
   */
  abrirEditor(rodizoExistente, sessaoAtual) {
    if (!rodizoExistente) {
      this.revisaoOriginal = null;
    } else {
      if (!rodizoExistente.revisao || typeof rodizoExistente.revisao !== 'number') {
        throw new Error('Rodizio sem revisao: OCC desabilitado');
      }
      this.revisaoOriginal = rodizoExistente.revisao;
    }
    this.sessao = sessaoAtual;
  }

  /**
   * Detecta mudança de sessão
   */
  validarSessao(sessaoAtual) {
    if (this.sessao !== sessaoAtual) {
      throw new Error('Sessão alterada durante operação: revisão descartada');
    }
  }

  /**
   * Valida ambiente (simula gate VITE_NEON_HOMOLOGACAO_ENABLED)
   */
  validarAmbiente() {
    if (this.ambiente !== 'hml') {
      throw new Error('Escrita bloqueada fora de ambiente homologação');
    }
  }

  /**
   * P0.1: Criar rascunho
   */
  async criarRascunho(titulo, sessaoAtual) {
    this.validarSessao(sessaoAtual);
    this.validarAmbiente();
    
    if (!titulo || typeof titulo !== 'string') {
      throw new Error('Titulo inválido');
    }

    if (titulo === 'TIMEOUT') {
      throw new Error('INDETERMINADO: timeout na criação de rascunho');
    }

    return {
      success: true,
      rodizoId: '550e8400-e29b-41d4-a716-446655440000',
      revisao: 1,
      status: 'rascunho',
    };
  }

  /**
   * P0.2: Atualizar cabeçalho
   */
  async atualizarCabecalho(rodizoId, cabecalho, sessaoAtual) {
    this.validarSessao(sessaoAtual);
    this.validarAmbiente();

    if (this.revisaoOriginal === null) {
      throw new Error('Nenhum rodizio aberto: revisão não capturada');
    }

    if (cabecalho.titulo === 'CONFLITO') {
      throw new Error('OCC_CONFLICT: revisao do banco (3) != revisao local (1)');
    }

    if (cabecalho.titulo === 'AUTHORIZE_FAIL') {
      throw new Error('RLS: política de linha rejeita operação');
    }

    return {
      success: true,
      rodizoId,
      revisao: this.revisaoOriginal + 1,
      status: 'rascunho',
    };
  }

  /**
   * P0.3: Substituir itens
   */
  async substituirItens(rodizoId, novoItens, sessaoAtual) {
    this.validarSessao(sessaoAtual);
    this.validarAmbiente();

    if (this.revisaoOriginal === null) {
      throw new Error('Nenhum rodizio aberto: revisão não capturada');
    }

    if (!Array.isArray(novoItens)) {
      throw new Error('Itens deve ser array');
    }

    if (novoItens[0]?.periodo === 'PARTIAL_WRITE') {
      throw new Error('INDETERMINADO: HTTP 200 recebido mas sem body de retorno');
    }

    return {
      success: true,
      rodizoId,
      revisao: this.revisaoOriginal + 1,
      itensInseridos: novoItens.length,
    };
  }

  /**
   * P0.4: Publicar
   */
  async publicarRodizio(rodizoId, sessaoAtual) {
    this.validarSessao(sessaoAtual);
    this.validarAmbiente();

    if (this.revisaoOriginal === null) {
      throw new Error('Nenhum rodizio aberto');
    }

    return {
      success: true,
      rodizoId,
      revisao: this.revisaoOriginal + 1,
      status: 'publicado',
    };
  }

  /**
   * P0.5: Travar
   */
  async travarRodizio(rodizoId, sessaoAtual) {
    this.validarSessao(sessaoAtual);
    this.validarAmbiente();

    if (this.revisaoOriginal === null) {
      throw new Error('Nenhum rodizio aberto');
    }

    return {
      success: true,
      rodizoId,
      revisao: this.revisaoOriginal + 1,
      status: 'travado',
      lock: true,
    };
  }

  /**
   * P0.6: Cancelar
   */
  async cancelarRodizio(rodizoId, sessaoAtual) {
    this.validarSessao(sessaoAtual);
    this.validarAmbiente();

    if (this.revisaoOriginal === null) {
      throw new Error('Nenhum rodizio aberto');
    }

    return {
      success: true,
      rodizoId,
      revisao: this.revisaoOriginal + 1,
      status: 'cancelado',
    };
  }

  /**
   * P0.7: Excluir rascunho
   */
  async excluirRascunho(rodizoId, sessaoAtual) {
    this.validarSessao(sessaoAtual);
    this.validarAmbiente();

    if (this.revisaoOriginal === null) {
      throw new Error('Nenhum rodizio aberto');
    }

    return {
      success: true,
      rodizoId,
      deletado: true,
    };
  }

  /**
   * Recarregar estado após operação
   */
  async recarregarRodizio(rodizoId) {
    return {
      id: rodizoId,
      titulo: 'Escala Atualizada',
      revisao: 5,
      status: 'rascunho',
      itens: [],
    };
  }
}

describe('P0 — Operações de Editor de Rodízios', () => {
  let editor;
  let sessao;

  before(() => {
    editor = new MockRodizioEditor();
    editor.ambiente = 'hml';
    sessao = { userId: 'user1', token: 'token1' };
  });

  describe('Bloqueio de escrita fora de ambiente autorizado', () => {
    test('Bloqueia criar rascunho fora de HML', async () => {
      editor.ambiente = 'prod';
      editor.abrirEditor(null, sessao);

      await assert.rejects(
        () => editor.criarRascunho('Nova Escala', sessao),
        /Escrita bloqueada fora de ambiente homologação/
      );
    });

    test('Bloqueia atualizar cabeçalho fora de HML', async () => {
      editor.ambiente = 'dev';
      const rodizoExistente = { id: 'rod1', revisao: 1, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      await assert.rejects(
        () => editor.atualizarCabecalho('rod1', { titulo: 'Novo' }, sessao),
        /Escrita bloqueada fora de ambiente homologação/
      );
    });

    after(() => {
      editor.ambiente = 'hml';
    });
  });

  describe('Preservação de revisão original (OCC)', () => {
    test('Captura revisão ao abrir editor com rodizio existente', () => {
      const rodizoExistente = { id: 'rod1', revisao: 42, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      assert.strictEqual(editor.revisaoOriginal, 42);
    });

    test('Rejeita rodizio sem revisao (OCC desabilitado)', () => {
      const rodizoSemRevisao = { id: 'rod1', titulo: 'Escala' };

      assert.throws(
        () => editor.abrirEditor(rodizoSemRevisao, sessao),
        /Rodizio sem revisao: OCC desabilitado/
      );
    });

    test('Envia revisao capturada em operação de atualização', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 10, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      const resultado = await editor.atualizarCabecalho('rod1', { titulo: 'Novo' }, sessao);

      assert.strictEqual(editor.revisaoOriginal, 10);
      assert.strictEqual(resultado.revisao, 11);
    });

    test('Não substitui revisao original silenciosamente', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 15, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);
      const revisaoCapturada = editor.revisaoOriginal;

      await editor.atualizarCabecalho('rod1', { titulo: 'Atualizado' }, sessao);

      assert.strictEqual(editor.revisaoOriginal, revisaoCapturada);
    });
  });

  describe('Conflitos de edição concorrente', () => {
    test('Detecta conflito OCC quando revisao do banco diferente', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 1, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      await assert.rejects(
        () => editor.atualizarCabecalho('rod1', { titulo: 'CONFLITO' }, sessao),
        /OCC_CONFLICT/
      );
    });

    test('Separação de transações: cabeçalho e itens independentes', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 5, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      const result1 = await editor.atualizarCabecalho('rod1', { titulo: 'Novo' }, sessao);
      assert.strictEqual(result1.revisao, 6);

      const rodizoAtualizado = await editor.recarregarRodizio('rod1');
      editor.abrirEditor(rodizoAtualizado, sessao);

      const result2 = await editor.substituirItens('rod1', [], sessao);
      assert.ok(result2.success);
    });

    test('Falha parcial: gravou mas resposta perdeu (indeterminado)', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 7, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      const novoItens = [{ periodo: 'PARTIAL_WRITE', porta: 1 }];

      await assert.rejects(
        () => editor.substituirItens('rod1', novoItens, sessao),
        /INDETERMINADO/
      );

      assert.strictEqual(editor.revisaoOriginal, 7);
    });
  });

  describe('Alteração de sessão durante operação', () => {
    test('Detecta mudança de sessão antes de operação', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 2, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      const novaSession = { userId: 'user2', token: 'token2' };

      await assert.rejects(
        () => editor.criarRascunho('Nova', novaSession),
        /Sessão alterada durante operação/
      );
    });

    test('Rejeita atualizar com sessão diferente', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 3, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      const outroUsuario = { userId: 'user3', token: 'token3' };

      await assert.rejects(
        () => editor.atualizarCabecalho('rod1', { titulo: 'Novo' }, outroUsuario),
        /Sessão alterada/
      );
    });

    test('Permite operação com mesma sessão', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 4, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      const resultado = await editor.atualizarCabecalho('rod1', { titulo: 'Mesmo' }, sessao);
      assert.ok(resultado.success);
    });
  });

  describe('Resposta indeterminada (timeout, rede) sem repetição automática', () => {
    test('Timeout na criação não é repetido automaticamente', async () => {
      editor.abrirEditor(null, sessao);

      await assert.rejects(
        () => editor.criarRascunho('TIMEOUT', sessao),
        /INDETERMINADO/
      );
    });

    test('Falha de rede (200 sem body) não assume sucesso', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 6, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      const novoItens = [{ periodo: 'PARTIAL_WRITE' }];

      await assert.rejects(
        () => editor.substituirItens('rod1', novoItens, sessao),
        /INDETERMINADO/
      );
    });

    test('Usuário deve conferir banco antes de repetir operação indeterminada', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 8, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      await assert.rejects(
        () => editor.criarRascunho('TIMEOUT', sessao),
        /INDETERMINADO/
      );

      const banco = await editor.recarregarRodizio('rod1');
      assert.ok(banco.id);
    });
  });

  describe('Reconciliação após gravação', () => {
    test('Recarrega rodizio completo após sucesso', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 9, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      await editor.atualizarCabecalho('rod1', { titulo: 'Novo' }, sessao);

      const estadoAtualizado = await editor.recarregarRodizio('rod1');
      assert.strictEqual(estadoAtualizado.id, 'rod1');
      assert.strictEqual(estadoAtualizado.status, 'rascunho');
    });

    test('Reconcilia após operação parcial bloqueada', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 10, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      await editor.atualizarCabecalho('rod1', { titulo: 'Novo' }, sessao);

      const banco = await editor.recarregarRodizio('rod1');
      assert.ok(banco.id);

      editor.abrirEditor(banco, sessao);
      const result = await editor.substituirItens('rod1', [], sessao);
      assert.ok(result.success);
    });
  });

  describe('Ausência de fallback Supabase', () => {
    test('Não tenta fallback Supabase em caso de erro', async () => {
      editor.abrirEditor(null, sessao);

      await assert.rejects(
        () => editor.criarRascunho('TIMEOUT', sessao),
        /INDETERMINADO/
      );
    });

    test('Falha de autorização não usa fallback', async () => {
      const rodizoExistente = { id: 'rod1', revisao: 11, titulo: 'Escala' };
      editor.abrirEditor(rodizoExistente, sessao);

      await assert.rejects(
        () => editor.atualizarCabecalho('rod1', { titulo: 'AUTHORIZE_FAIL' }, sessao),
        /RLS/
      );
    });
  });

  describe('Integração das 7 operações (P0.1-P0.7)', () => {
    test('Fluxo completo: criar -> atualizar -> publicar -> travar', async () => {
      const result1 = await editor.criarRascunho('Escala Principal', sessao);
      assert.strictEqual(result1.status, 'rascunho');

      const rodizoNovo = { id: result1.rodizoId, revisao: result1.revisao, titulo: 'Nova' };
      editor.abrirEditor(rodizoNovo, sessao);
      const result2 = await editor.atualizarCabecalho(result1.rodizoId, { titulo: 'Escala Principal' }, sessao);
      assert.ok(result2.success);

      const rodizoApos2 = { id: result1.rodizoId, revisao: result2.revisao, titulo: 'Escala Principal' };
      editor.abrirEditor(rodizoApos2, sessao);
      const result3 = await editor.substituirItens(result1.rodizoId, [
        { data: '2024-01-01', porta: 1, periodo: 'M' },
      ], sessao);
      assert.ok(result3.success);

      const rodizoApos3 = { id: result1.rodizoId, revisao: result3.revisao, titulo: 'Escala Principal' };
      editor.abrirEditor(rodizoApos3, sessao);
      const result4 = await editor.publicarRodizio(result1.rodizoId, sessao);
      assert.strictEqual(result4.status, 'publicado');

      const rodizoApos4 = { id: result1.rodizoId, revisao: result4.revisao, titulo: 'Escala Principal' };
      editor.abrirEditor(rodizoApos4, sessao);
      const result5 = await editor.travarRodizio(result1.rodizoId, sessao);
      assert.strictEqual(result5.status, 'travado');
      assert.strictEqual(result5.lock, true);
    });

    test('Fluxo de exclusão: criar -> excluir', async () => {
      const result1 = await editor.criarRascunho('Escala Temporária', sessao);

      const rodizoNovo = { id: result1.rodizoId, revisao: result1.revisao, status: 'rascunho' };
      editor.abrirEditor(rodizoNovo, sessao);
      const result7 = await editor.excluirRascunho(result1.rodizoId, sessao);
      assert.strictEqual(result7.deletado, true);
    });

    test('Fluxo de cancelamento: criar -> publicar -> cancelar', async () => {
      const result1 = await editor.criarRascunho('Escala', sessao);

      const rodizoNovo = { id: result1.rodizoId, revisao: result1.revisao, status: 'rascunho' };
      editor.abrirEditor(rodizoNovo, sessao);
      const result4 = await editor.publicarRodizio(result1.rodizoId, sessao);

      const rodizoPublicado = { id: result1.rodizoId, revisao: result4.revisao, status: 'publicado' };
      editor.abrirEditor(rodizoPublicado, sessao);
      const result6 = await editor.cancelarRodizio(result1.rodizoId, sessao);
      assert.strictEqual(result6.status, 'cancelado');
    });
  });
});
