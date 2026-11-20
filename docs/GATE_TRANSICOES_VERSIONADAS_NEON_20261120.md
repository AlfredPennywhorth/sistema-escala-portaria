# Gate de homologação — Publicação e travamento versionados (Neon)

**Situação:** PR #2 draft. Proposta SQL `migration/neon/05_versioned_publish_lock_PROPOSAL.sql` NÃO aplicada a nenhum banco. Adaptador `src/services/neon/rodizioStatusVersionedHmlService.ts` ainda não vinculado à interface. É necessário novo consentimento explícito para instalar a SQL e gravar dados fictícios exclusivamente na branch `br-holy-term-b6v6ofea` (projeto `blue-sky-02214231`).

## Revisões e verificações antes de aplicar

1. Confirmar branch Neon pelo ID, não por nome/endpoint: `br-holy-term-b6v6ofea`; conferir revisão atual do SQL e hash do commit aprovado.
2. Confirmar RPC versionada 04, coluna `rodizios.revisao`, RLS atual, grants, gatilhos `trg_bloquear_rodizio_travado` e `trg_bloquear_itens_travados`. Nenhuma alteração na branch-mãe `br-late-night-b6pydxvn`, na HML principal ou produção.
3. Registrar cópia de controle *somente leitura* de todos os rodízios e itens (IDs, status, travado, travado_em, revisao, título, datas, observações, timestamps) antes de testes; contagens isoladas não substituem comparação de conteúdos.
4. Criar fixtures de transição **novas e exclusivas** de rascunho com item e rascunho sem item, em transação controlada, sem reutilizar as fixtures `...202`, `...203`, `...204`, `...205`. Rotular como `TESTE FICTICIO TRANSICAO OCC` e não incluir dados pessoais reais.
5. Aplicar a SQL 05 apenas mediante autorização específica. Validar `SECURITY INVOKER`, execução somente para `authenticated`, nenhuma concessão de `USAGE` ao schema `auth`.

## Matriz de testes obrigatórios

| Caso | Contexto | Esperado |
|---|---|---|
| T01 | Admin JWT, rascunho com 1 item, revisão 0, publicar com versão 0 | Publicado, `travado=false`, revisão 1 |
| T02 | Admin JWT, publicar novamente com versão 0 | Erro de conflito `P0001`; conteúdo preservado |
| T03 | Admin JWT, tentar travar publicado com versão 0 | Erro `P0001`; estado preservado |
| T04 | Admin JWT, travar publicado com versão 1 | Travado, data de travamento definida, revisão 2 |
| T05 | Admin JWT, tentar editar/travar item após travamento | Negado pelo banco; histórico imutável |
| T06 | Admin JWT, publicar rascunho sem item | Negado; revisão não incrementa |
| T07 | Admin JWT, travar rascunho | Negado; revisão não incrementa |
| T08 | Admin JWT, publicar escala publicada ou travada | Negado, sem alteração |
| T09 | Admin JWT, travar escala sem itens | Negado, sem alteração |
| T10 | Coordenadora JWT, publicar/travar | Negado pelo banco (não apenas UI) |
| T11 | Auxiliar JWT, publicar/travar | Negado pelo banco (não apenas UI) |
| T12 | Sem JWT / anonymous | Execução negada, sem efeitos |
| T13 | Dois Admins carregam revisão 0; um publica, outro tenta publicar/travar com 0 | Segundo recebe conflito, primeiro preservado |
| T14 | Admin abre revisão 0; outro publica; primeiro tenta substituir itens usando revisão 0 | Conflito; nenhuma alteração |
| T15 | Falha de rede após envio e commit | Reconciliação obrigatória, sem repetição automática |
| T16 | Dois clientes com conexões simultâneas disputam `FOR UPDATE` | Execução serializada, sem versão perdida; evidência de bloqueio real |

**Observação:** testes T13 e T14 podem usar dois snapshots independentes e execuções sequenciais; **T16 exige conexões efetivamente simultâneas**. Não afirmar T16 aprovado com base em testes sequenciais ou uma única transação.

## Auditoria da integridade e rollback

- Toda gravação deve comparar `status`, `travado`, `travado_em`, `revisao` e **todos os itens** antes e depois.
- SQLSTATE conhecido significa falha/rollback da chamada; erros de rede sem SQLSTATE são indeterminados até reconciliação.
- Reverter/remover somente as fixtures novas de transição, após conferir IDs e conteúdos. Não apagar ou recriar as fixtures das provas anteriores.
- Preservar wrappers de identidade, RLS e gatilhos; jamais alterar a role global da sessão de produção.
- Registrar evidência e relatório na PR #2, CI, revisão Codex, SQL aplicado e branch exata. Não usar credenciais, JWT ou URLs secretas em comentários.

## Gate sistêmico **ainda não resolvido**

A RPC 03 sem versão, DML direto do papel `authenticated`, alteração/cancelamento/exclusão de cabeçalho e lançamento do histórico podem contornar `revisao`. Portanto, mesmo que T01–T16 passem, **não conectar as transições à UI operacional** antes de migrar todas as rotas de escrita e autorizar migração coordenada para menor privilégio no banco. Em particular, não revogar `INSERT/UPDATE/DELETE` isoladamente, pois as RPCs atuais usam `SECURITY INVOKER`.

## Situação e autorização

Autorização anterior: aplicação **somente da SQL 04** em branch descartável. A SQL 05 não está abrangida por aquela autorização. A PR #2 continua draft; sem merge, sem deploy em produção, sem alterações na branch Neon principal.
