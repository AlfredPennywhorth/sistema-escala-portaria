# SQL 06 — Gate para RPCs administrativas versionadas (21/11/2026 — preparação)

## Escopo
Arquivo de **proposta, não aplicado**: `migration/neon/06_remaining_admin_mutations_PROPOSAL.sql`.
Branch GitHub da PR #2: `chore/neon-migration-prep-20261115`.
Branch Neon pretendida para ensaio: `br-holy-term-b6v6ofea`, descartável. Não aplicar na HML principal, Neon main ou produção.

## Objetivo
Completar o contrato de escrita de escalas sem depender de DML REST direto:
- `criar_rodizio_rascunho_versionado`: cria rascunho não travado com revisão inicial 0.
- `atualizar_cabecalho_rascunho_versionado`: somente rascunho; bloqueia row lock, compara revisão e rejeita período que exclui itens existentes; revisão +1.
- `cancelar_rodizio_versionado`: somente rascunho/publicado não travado; compara revisão; cancela preservando itens.
- `excluir_rodizio_rascunho_versionado`: somente rascunho não travado; compara revisão; deleção cascata de itens apenas na mesma transação.

Todas as RPCs usam `SECURITY INVOKER` nesta fase, `search_path=''`, verificam JWT pelo wrapper da branch, exigem `admin`, negam `anonymous`. Seus testes não autorizam cutover; a role `authenticated` ainda tem DML direto.

## Checagens técnicas antes de qualquer aplicação
1. Confirmar HEAD da PR e hashes dos arquivos SQL 04/05/06; backup de baseline das fixtures; inspecionar origem e nomes das funções atuais.
2. Revisar regras de negócio: edição de publicado não travado é **não suportada por esta proposta**; eventual edição de publicado exigirá contrato novo e aceitação.
3. Review SQL específico: tipos, intervalos de data, CPF/PII ausentes nas fixtures, RLS, `SECURITY INVOKER`, proteção de histórico, ON DELETE CASCADE.
4. Autorizar instalação somente na branch descartável; executar uma alteração por vez em fixtures inéditas, com recuperação/rollback.

## Matriz obrigatória após autorização
| Caso | Resultado esperado |
| --- | --- |
| A — Admin cria rascunho | revisão 0, `travado=false`, estado rascunho |
| B — Admin edita cabeçalho, revisão 0 | revisão 1 e conteúdo exato |
| C — Outro Admin edita com revisão antiga 0 | `P0001`; primeiro valor preservado |
| D — Admin tenta encurtar período excluindo item | `22023`; nada muda |
| E — Admin cancela rascunho ou publicado não travado | revisão +1, itens preservados |
| F — Admin tenta cancelar histórico travado | negado, histórico intacto |
| G — Admin exclui rascunho com itens | cabeçalho e itens fictícios ausentes; demais registros intactos |
| H — Admin tenta excluir publicado/travado | negado |
| I — Coordenadora, Auxiliar, sem vínculo e sem JWT | todos os métodos negados por autorização |
| J — Conflito com edição/substituição/publicação | somente transação com revisão atual vence; sem lost update |
| K — Erro de rede após commit | reconciliar antes de qualquer reexecução |
| L — Mesmo ID criado/atualizado duas vezes | nova chamada não pode causar duplicação/efeito não intencional |

## Gate seguinte: menor privilégio e bypasses
Antes da liberação, revisar e converter apenas RPCs aprovadas para execução com privilégio elevado **estritamente limitado**, identidade verificada no banco e `search_path` fixo. Em migração coordenada, revogar DML direto em `rodizios`/`rodizio_itens` da role `authenticated` e revogar EXECUTE da RPC sem versão, sem interromper as novas RPCs. Rever risco de owner bypass de RLS e dependências de objetos, políticas de leitura, triggers e auditoria. Testar todos os perfis com JWT e conexão simultânea real.

**Não aplicar revogação isolada** enquanto RPCs versionadas ainda são `SECURITY INVOKER`. A SQL 06 não encerra sozinha o gate de bypass.

## Critério Go/No-Go
Go apenas se todos os casos A–L forem provados, DML direto e RPC legada estiverem inacessíveis, CI e revisão independente aprovados, migração funcional completa e backup reconciliado. A produção não foi alterada por este documento.

## Atualização — adaptadores isolados e CI (20/11/2026)

Foi criado `src/services/neon/rodizioAdminSql06HmlService.ts` na PR #2. O código contém quatro chamadas RPC SQL 06 e, por padrão, não é consumido pela UI. Cada operação confirma a flag de homologação, sessão JWT, vínculo com perfil `admin` e valida argumentos, sem fallback de DML direto nem repetição automática. Criação retorna UUID, atualizações/cancelamento exigem revisão original e resultado `revisaoOriginal+1`, exclusão exige retorno `true`.

A criação de rascunho **não é idempotente**; falha de transporte depois do COMMIT pode deixar o estado indeterminado. A integração à interface somente será aceita após adoção de uma estratégia de idempotência (por exemplo, identificador de comando único) ou reconciliação explícita obrigatória sem retentativa automática.

`tests/neon-contracts.test.mjs` foi ampliado com as verificações estáticas dos adaptadores. Estas verificações **não equivalem** a testes PostgreSQL/JWT real e não provam a semântica de concorrência ou RLS. A SQL 06 permanece não aplicada em qualquer branch do Neon.

Ainda pendente: revisão técnica das propostas; teste de JWT real na branch descartável; revisão de autorização `SECURITY DEFINER`/RLS antes de qualquer revogação coordenada; fechamento de todas as vias DML e RPC legada; integração funcional e dados reais.

## Revisão adicional de segurança — 20/11/2026

**Ponto crítico detectado:** `criarClienteNeon()` usa `VITE_NEON_AUTH_URL` e `VITE_NEON_DATA_API_URL` da HML principal no build padrão, portanto não era suficiente verificar apenas `VITE_NEON_HOMOLOGACAO_ENABLED`.

Correção na PR #2: o adaptador `rodizioAdminSql06HmlService.ts` passou a exigir cumulativamente `VITE_NEON_SQL06_ENABLED='true'`, `VITE_NEON_HOMOLOGACAO_ENABLED='true'` e correspondência **exata** dos endpoints públicos de autenticação e dados do compute `ep-nameless-dust-b6271958`, vinculado à branch descartável `br-holy-term-b6v6ofea`. O build padrão da Cloudflare HML **não habilita** `VITE_NEON_SQL06_ENABLED`. Verificações estáticas adicionadas ao CI.

Essas flags no browser são guardas operacionais, não fronteiras de segurança: autorização definitiva deve permanecer em JWT/RLS/RPC no banco. O código segue sem ligação à UI, e a SQL 06 segue **não aplicada**. Revalidar endpoints e IDs de branch antes da futura instalação. A revisão corrigiu ainda a validação de data ISO no adaptador para não interpretar anos 00–99 como 1900–1999.

### Dependências pendentes
- Revisão independente de SQL06 e plano de migração coordenada para menor privilégio.
- Autorização específica antes de executar SQL06 na branch descartável.
- Homologação JWT real / concurrência / baseline / rollback.
- Origem e backup dos dados reais, migração funcional, CI E2E e Go/No-Go final.

## Pré-instalação independente — 20/11/2026

Preflight executado por SELECT em `br-holy-term-b6v6ofea`, banco `rodizio_portas`, conexão proprietária exclusivamente de leitura. Resultado: 7 cabeçalhos de escalas, 7 itens; `criar_rodizio_rascunho_versionado`, `atualizar_cabecalho_rascunho_versionado`, `cancelar_rodizio_versionado` e `excluir_rodizio_rascunho_versionado` **não instaladas**. Nenhum dado ou grant foi alterado.

Script reproduzível `migration/neon/tests/07_sql06_preflight_readonly.sql`; contém apenas SELECT, verifica instalações por `to_regprocedure` e traz resumo das fixtures já existentes. Antes de instalar, ainda é indispensável baseline completo, revisão independente, autorização explícita e fixtures *novas* para não reutilizar 206/207/208.

Corrigido no TypeScript: validação de cabeçalho rejeita `null` e payloads não objetos (entrada externa pode não respeitar o tipo TS). Testes estáticos adicionados para garantir guarda e preflight read-only.

**Estado:** preparada, não instalada, não homologada por JWT real. A aprovação do CI indica qualidade estática/build, não autorização para rodar DDL.

## Tela temporária — Pré-homologação SQL 06 somente leitura

Após a instalação SQL06 e sua reconciliação independente, a PR #2 recebeu uma seção na tela `NeonRpcBranchHomologacao` chamada **SQL 06 — pré-homologação**. O botão `SQL 06 — conferir fixtures (somente leitura)` utiliza a sessão JWT da branch descartável e executa apenas SELECTs em `rodizios` e `rodizio_itens`, com verificação dos estados/revisões esperados das fixtures 206 (travado/revisão 2/um item), 207 (rascunho/revisão 0/vazia) e 208 (publicado/revisão 0/um item). Com Auxiliar/Coordenadora, os resultados são expressamente qualificados como visão parcial da RLS.

**Nenhuma função SQL06 é invocada nessa tela**. Testes de criação, edição, cancelamento e exclusão de fixtures novas aguardam autorização específica. O CI ganhou teste estático contra mutações no método de preflight. O domínio da tela permanece limitado ao Cloudflare Pages da HML de testes com opt-in `?rpc-branch-test=1`, que usa endpoints fixos da branch descartável.

Status: código e teste adicionados à PR #2; publicação efetiva em Cloudflare e verificação JWT no navegador ainda não confirmadas nesta etapa. Os dados reais, HML principal e produção permanecem fora do escopo.

## Evidência de campo — Auxiliar / SQL05 e SQL06 (20/11/2026)

Usuário forneceu capturas da tela de homologação isolada. Sessão JWT válida no perfil `auxiliar` da branch descartável. Para SQL05, as capturas mostram rejeição pelo banco com SQLSTATE `42501` nos testes negativos de publicação e travamento (T10/T11); a RPC legada de escrita de itens também foi recusada com `42501`. Botões positivos Admin apresentaram corretamente restrição de perfil. Logout retornou ausência confirmada de sessão. Esses testes não demonstram negativação da SQL06 nova.

A nova seção SQL06 **já estava publicada e acessível** no teste de campo. O botão somente leitura produziu aviso de ausência de gravações, exibiu ao perfil Auxiliar as fixtures 206 (travado, revisão 2, um item) e 208 (publicado, revisão 0, um item); a fixture 207, em rascunho, não foi exibida, conforme a RLS. A interface qualificou corretamente a visão de RLS como parcial. Uma consulta independente SELECT no PostgreSQL da mesma branch confirmou 206 = travado/revisão 2/um item, 207 = rascunho/revisão 0/zero itens, 208 = publicado/revisão 0/um item.

**Resultado deste gate parcial:** preflight SQL06 de leitura com JWT Auxiliar aprovado; negativas SQL05 por Auxiliar aprovadas. Permanecem pendentes JWT Admin para preflight completo, negativas específicas das quatro novas funções SQL06 por perfis não-admin, testes positivos em novas fixtures, concorrência, idempotência, timeout e fechamento do DML direto. Nenhuma mutação SQL06 autorizada ou executada nesta rodada.

## Evidência de campo — Administrador / Preflight SQL06 (20/11/2026)

Captura fornecida pelo usuário: autenticação JWT na branch descartável, perfil `admin`, resultado da interface `preflight de dados aprovado` e indicação `SQL06: apenas SELECT — sem chamada RPC`. Foram visualizadas as três fixtures: 206 travado/revisão 2/um item, 207 rascunho/revisão 0/zero itens, 208 publicado/revisão 0/um item.

Reconciliado por SELECT independente na mesma branch `br-holy-term-b6v6ofea`: os três IDs permanecem exatamente nesses estados/revisões e quantidades. Nenhuma mutação realizada. PR #2 permanece draft, sem merge.

**Conclusão:** pré-homologação de leitura SQL06 com JWT Admin e Auxiliar concluída nos dois perfis testados. Coordenadora, negativas específicas das RPCs SQL06, positivos em novas fixtures, concorrência, rollback e fechamento de escrita direta seguem pendentes. Não repetir SQL05 T01/T04.
