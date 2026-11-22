import { useState } from 'react';
import { confirmarCodigoEmail, loginComEmailSenha, logout, solicitarCodigoEmail } from '../services/neon/authService';
import { verificarNeonPilot, verificarLeituraEscalasNeon, verificarPermissoesAuxiliarNeon } from '../services/neonPilotService';
import { verificarEscritaRestricoesNeon } from '../services/neonWriteAuditService';
import { verificarEscritaItensRascunhoNeon } from '../services/neonItensWriteAuditService';
import { verificarProtecaoHistoricoNeon } from '../services/neonHistoricoAuditService';
import { verificarLeiturasFuncionaisNeon } from '../services/neon/areaAuxiliarReadService';
import { verificarCatalogosNeon } from '../services/neon/catalogosReadService';

/**
 * Tela apenas para ambiente isolado com VITE_NEON_HOMOLOGACAO_ENABLED=true.
 * Não ativar sem domínio de teste autorizado pelo Neon Auth.
 */
export function NeonAuthHomologacao() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [resumo, setResumo] = useState<string | null>(null);

  async function executar(operacao: () => Promise<void>) {
    setOcupado(true);
    setMensagem('');
    try {
      await operacao();
    } catch {
      setMensagem('Falha de conexão. Verifique as URLs de homologação.');
    } finally {
      setOcupado(false);
    }
  }

  async function conferirSessao() {
    const resultado = await verificarNeonPilot();
    if (resultado.erro) {
      setResumo(null);
      setMensagem(resultado.erro);
      return;
    }
    setResumo(JSON.stringify({
      autenticado: resultado.conectado,
      usuario: resultado.usuario ? 'Identidade verificada' : 'Sem identidade',
      perfil: resultado.perfil?.perfil ?? 'Sem vínculo',
    }, null, 2));
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <section className="mx-auto max-w-md rounded-xl bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Homologação Neon Auth</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ambiente de testes isolado. Não utilize senhas de produção enquanto as contas não forem migradas.
        </p>
        <a
          className="mt-3 inline-block rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-800"
          href="?operacional-neon=1"
        >
          Abrir prévia operacional Neon (somente leitura, exige Admin)
        </a>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void executar(async () => {
              const retorno = await loginComEmailSenha(email, senha);
              setSenha('');
              if (retorno.error) {
                setResumo(null);
                setMensagem(retorno.error);
                return;
              }
              setMensagem('Login aceito pelo provedor. Confira o vínculo e as permissões.');
              await conferirSessao();
            });
          }}
        >
          <label className="block text-sm font-medium text-slate-700" htmlFor="neon-email">E-mail de teste</label>
          <input
            id="neon-email"
            className="w-full rounded-md border border-slate-300 p-3"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="block text-sm font-medium text-slate-700" htmlFor="neon-senha">Senha de teste</label>
          <input
            id="neon-senha"
            className="w-full rounded-md border border-slate-300 p-3"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button className="w-full rounded-md bg-blue-700 px-4 py-3 text-white disabled:opacity-50" type="submit" disabled={ocupado}>
            Entrar com Neon Auth
          </button>
        </form>
        <section className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Acesso de teste por código de e-mail</h2>
          <p className="mt-1 text-xs text-slate-700">Para a conta previamente cadastrada. Solicitar não comprova entrega; informe o código recebido para confirmar a sessão.</p>
          <button
            type="button"
            className="mt-3 w-full rounded-md border border-blue-600 px-4 py-3 text-blue-800 disabled:opacity-50"
            disabled={ocupado || !email.trim()}
            onClick={() => void executar(async () => {
              const retorno = await solicitarCodigoEmail(email);
              setMensagem(retorno.error || 'Pedido enviado ao provedor. Confira a caixa postal e o spam; o recebimento ainda não foi confirmado.');
            })}
          >Solicitar código por e-mail</button>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="neon-codigo">Código recebido</label>
          <input
            id="neon-codigo"
            className="mt-1 w-full rounded-md border border-slate-300 p-3"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de verificação"
          />
          <button
            type="button"
            className="mt-3 w-full rounded-md bg-blue-700 px-4 py-3 text-white disabled:opacity-50"
            disabled={ocupado || !email.trim() || !codigo.trim()}
            onClick={() => void executar(async () => {
              const retorno = await confirmarCodigoEmail(email, codigo);
              setCodigo('');
              if (retorno.error) {
                setMensagem(retorno.error);
                return;
              }
              setMensagem('Código aceito pelo provedor. Verifique sua sessão e seu perfil.');
              await conferirSessao();
            })}
          >Confirmar código e entrar</button>
        </section>
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          Teste controlado somente em homologação: tenta criar uma restrição fictícia.
          Auxiliar deve receber bloqueio; Coordenadora e Administrador devem conseguir criar e excluir.
          O resultado indica se a limpeza foi confirmada.
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(conferirSessao)}
          >Verificar sessão e perfil</button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarLeituraEscalasNeon();
              setResumo(null);
              setMensagem(retorno.erro || ((retorno.dados?.length ?? 0) === 0
                ? 'Nenhuma escala visível para esta sessão. A consulta não retornou registros.'
                : `Consulta retornou ${retorno.dados?.length ?? 0} escala(s) visível(is) para esta sessão.`));
            })}
          >Testar acesso às escalas</button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarLeiturasFuncionaisNeon();
              if (retorno.erro) {
                setResumo(null);
                setMensagem(retorno.erro);
                return;
              }
              setMensagem('Leituras funcionais Neon concluídas com JWT e RLS. Confira o resumo: nenhuma escrita foi executada.');
              setResumo(JSON.stringify(retorno.dados, null, 2));
            })}
          >Testar consultas funcionais Neon (somente leitura)</button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarCatalogosNeon();
              if (retorno.erro) {
                setResumo(null);
                setMensagem(retorno.erro);
                return;
              }
              setMensagem('Catálogos Neon consultados via JWT e RLS, sem escrita. Ausência de restrições não comprova sozinha bloqueio por policy.');
              setResumo(JSON.stringify(retorno.dados, null, 2));
            })}
          >Testar cadastros, restrições e itens Neon (leitura)</button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarPermissoesAuxiliarNeon();
              if (retorno.erro) {
                setResumo(null);
                setMensagem(retorno.erro);
                return;
              }
              setMensagem('Resultado de leitura RLS com sua sessão. Os campos abaixo mostram registros visíveis, não privilégios administrativos.');
              setResumo(JSON.stringify(retorno.dados, null, 2));
            })}
          >Homologar permissões de Auxiliar</button>
          <button
            type="button"
            className="rounded-md border border-amber-600 bg-amber-50 px-4 py-3 text-amber-950 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarEscritaRestricoesNeon();
              if (retorno.erro) {
                setResumo(null);
                setMensagem(retorno.erro);
                return;
              }
              setMensagem(retorno.dados?.resultado === 'aprovado'
                ? 'Teste de escrita RLS aprovado. Confira o resultado e a limpeza abaixo.'
                : 'Teste de escrita RLS não aprovado ou inconclusivo. Verifique os detalhes.');
              setResumo(JSON.stringify(retorno.dados, null, 2));
            })}
          >Testar escrita RLS — restrições (HML)</button>
          <button
            type="button"
            className="rounded-md border border-amber-600 bg-amber-50 px-4 py-3 text-amber-950 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarEscritaItensRascunhoNeon();
              if (retorno.erro) {
                setResumo(null);
                setMensagem(retorno.erro);
                return;
              }
              setMensagem(retorno.dados?.resultado === 'aprovado'
                ? 'Escrita de item em rascunho e limpeza verificadas no Neon HML.'
                : 'Teste de escrita de item inconclusivo/reprovado. Verifique UUID e limpeza no resumo.');
              setResumo(JSON.stringify(retorno.dados, null, 2));
            })}
          >Testar gravação e limpeza de item fictício (Admin HML)</button>
          <button
            type="button"
            className="rounded-md border border-slate-400 bg-slate-50 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await verificarProtecaoHistoricoNeon();
              if (retorno.erro) {
                setResumo(null);
                setMensagem(retorno.erro);
                return;
              }
              setMensagem(retorno.dados?.resultado === 'aprovado'
                ? 'Gatilho de histórico confirmado: alteração recusada.'
                : retorno.dados?.mecanismoBloqueio === 'rls'
                  ? 'Escala travada protegida por RLS (0 linhas afetadas). O gatilho não foi exercitado; teste do gatilho inconclusivo.'
                  : 'Proteção do histórico não aprovada ou inconclusiva. Confira os detalhes.');
              setResumo(JSON.stringify(retorno.dados, null, 2));
            })}
          >Testar proteção de escala travada (Admin HML)</button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-3 text-slate-800 disabled:opacity-50"
            disabled={ocupado}
            onClick={() => void executar(async () => {
              const retorno = await logout();
              setResumo(null);
              setSenha('');
              // O provedor pode lançar erro depois de invalidar a sessão local.
              // Sempre conferir o estado real antes de declarar falha ou sucesso.
              const verificacao = await verificarNeonPilot();
              if (verificacao.conectado || verificacao.usuario) {
                setMensagem('ATENÇÃO: sessão ainda autenticada após o logout.'
                  + (retorno.error ? ' Erro do provedor: ' + retorno.error : '')
                  + ' Não considerar aprovado.');
                return;
              }
              if (verificacao.erro === 'Sessão autenticada obrigatória') {
                setMensagem(retorno.error
                  ? 'Sessão ausente na verificação posterior, mas o provedor relatou erro no logout: '
                    + retorno.error + '. Resultado parcial; confirme também o acesso às escalas.'
                  : 'Logout confirmado: a verificação posterior não encontrou sessão autenticada. Teste agora o acesso às escalas.');
              } else {
                setMensagem('Logout inconclusivo: '
                  + (retorno.error ? 'erro do provedor: ' + retorno.error + '; ' : '')
                  + 'verificação posterior: ' + (verificacao.erro || 'estado desconhecido'));
              }
            })}
          >Encerrar sessão</button>
        </div>
        {mensagem && <p role="status" className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{mensagem}</p>}
        {resumo && <pre className="mt-3 overflow-auto rounded-md bg-slate-100 p-3 text-xs text-slate-700">{resumo}</pre>}
        <p className="mt-5 text-xs text-slate-500">Esta tela não comprova sozinha a homologação: registre testes de acesso permitido e negado por perfil.</p>
      </section>
    </main>
  );
}
