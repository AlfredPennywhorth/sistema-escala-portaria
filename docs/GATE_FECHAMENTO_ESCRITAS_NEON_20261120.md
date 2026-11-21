# Gate de fechamento de rotas de escrita Neon — 20/11/2026

## Evidência de permissões da branch descartável
Consulta direta à `br-holy-term-b6v6ofea` confirmou que `authenticated` possui `SELECT/INSERT/UPDATE/DELETE` nas tabelas `rodizios` e `rodizio_itens`. As policies de itens permitem gravar quando o perfil é `admin` e a escala não está travada. A policy de atualização do cabeçalho permite alterações do admin em escalas não travadas.

A RPC `substituir_itens_rodizio_rascunho_versionado(uuid,jsonb,bigint)` está como `SECURITY INVOKER`. Ela **depende** dos privilégios DML de `authenticated`. Revogar INSERT/UPDATE/DELETE diretamente quebraria a RPC versionada, portanto **não executar essa revogação isoladamente**.

## Caminhos que ainda podem contornar OCC
- DML direto do Admin em `rodizio_itens`: permitido pelo conjunto atual de GRANT/RLS quando a escala não está travada.
- DML direto do Admin em `rodizios`: pode publicar ou alterar sem revisão original.
- RPC antiga `substituir_itens_rodizio_rascunho(uuid,jsonb)`: ainda pode ser executada por `authenticated`; não exige `revisao`.
- Código legado `src/services/rodiziosService.ts`: usa Supabase e `DELETE` + `INSERT` em requests distintos. Ainda não substituir o serviço produtivo sem migração completa.

## Mudança segura proposta (NÃO APLICADA)
1. Reunir todas as operações administrativas de alteração de escalas em RPCs versionadas e autorizadas no banco: substituir itens, publicar, travar, cancelar, editar cabeçalho e excluir rascunho.
2. Migrar todos os consumidores, com revisão original obtida na abertura do editor. `src/services/neon/rodizioDraftVersionedWriteService.ts` e `src/services/neon/rodizioFunctionalHmlService.ts` são preparações de código **desconectadas da interface produtiva**.
3. Em implantação coordenada e com aprovação separada, fazer as RPCs de mutação como `SECURITY DEFINER` **estritamente auditadas** com `SET search_path=''`, checagem explícita de identidade/perfil, validação de estado, revisão e ownership; privilégios mínimos e sem vazar função sensível. **Não converter cegamente a RPC atual para DEFINER**, pois isso altera o modelo de RLS e pode permitir bypass.
4. Na mesma migração controlada, revogar DML direto de `authenticated` e EXECUTE da RPC antiga para `PUBLIC` e `authenticated`, garantindo que apenas RPCs autorizadas sigam funcionando. A migração tem que preservar SELECT e RLS de leitura conforme perfil.
5. Homologar com JWT real Admin/Coordenadora/Auxiliar, sem JWT, escala rascunho/publicada/travada; testar concorrência real entre conexões, rollback de FK, network timeout após commit, e verificação independente dos itens e revisão.
6. Validar fluxos completos de publicação/travamento, histórico, proteção de pastas; só depois conectar interface Neon de HML principal com novo gate explícito.

## Critério de aprovação
Nenhuma operação de escrita contorna a revisão, nenhuma conta sem perfil Admin grava itens, histórico travado permanece imutável, e falha de transporte não leva a reexecução cega. **CI/Codex e o teste SQL isolado anterior não comprovam esse gate.**

## Escopo
Esta nota e o código de adaptador são exclusivamente alterações na PR #2 em DRAFT. Nenhuma DDL/DML adicional foi aplicada no Neon após a SQL versionada já autorizada. Nenhum merge/deploy em produção.

## Aceleração de 20/11 — contenção de risco no código Neon (não é fechamento do banco)
- `src/services/neon/rodiziosService.ts`: desabilitadas explicitamente as seis operações legadas de escrita (criação, substituição de itens, publicação, travamento, cancelamento, exclusão de rascunho), retornando erro fechado; funções de leitura preservadas. Não afeta `src/services/rodiziosService.ts` nem a produção Supabase.
- Novo teste `tests/neon-contracts.test.mjs` verifica guardas estáticos de autorização, revisão OCC, cautela contra repetição de RPC e bloqueio das seis escritas legadas. Workflow de PR atualizado para rodá-lo e considerar alterações em `migration/neon/**`.
- **Importante:** controles estáticos não substituem SQL com JWT real, concorrência e migração. DML direto na Data API e RPC não versionada **continuam disponíveis no banco descartável**. Não marcar o gate sistêmico como fechado.
- Próximo pacote de execução: novas RPCs de todas as mutações administrativas, revisão de `SECURITY DEFINER`, concessões mínimas e retirada **atômica** de DML direto e EXECUTE legado numa branch descartável, após autorização específica e testes de integração.

## Auditoria de superfície efetiva do banco — 20/11/2026 (somente leitura)
Consultadas `pg_policies`, `pg_proc` e permissões efetivas na branch descartável `br-holy-term-b6v6ofea`. Há RLS ativa nas cinco tabelas de negócio. Para `authenticated`, `rodizios` e `rodizio_itens` continuam com INSERT/UPDATE/DELETE diretos; as policies autorizam essas escritas para Admin em escala não travada, sem conferência geral da coluna `revisao`. A RPC legada `substituir_itens_rodizio_rascunho(uuid,jsonb)` continua executável por `authenticated` e não exige revisão original. RPCs versionadas de substituir, publicar e travar são SECURITY INVOKER. Não foram feitas mutações nesse diagnóstico.

Novo preflight reproduzível: `migration/neon/tests/06_write_surface_audit_readonly.sql`; só consulta catálogos, sinaliza bypasses potenciais e não altera privilégios. **Gate de escrita do banco permanece aberto**, apesar do bloqueio fail-closed de seis métodos no serviço Neon e do CI de contrato.

Correção funcional isolada: `src/services/neon/restricoesService.ts` passou a respeitar limite superior `dataFim` em duas consultas por período sem excluir restrições recorrentes (data NULL com dia_semana presente); adicionada verificação de contrato em `tests/neon-contracts.test.mjs`. Atenção: o serviço legado Supabase ainda mantém o comportamento antigo, e a homologação por JWT dessa mudança funcional permanece pendente.

Próximo gate exige planejar e revisar **todas** as RPCs administrativas de escrita, executar migração coordenada de privilégios em branch descartável, comprovar JWT real e concorrência; não retirar grants isoladamente.

## Auditoria consolidada das sete RPCs — 21/11/2026

Consulta **somente leitura**, reproduzível em `migration/neon/tests/11_write_surface_full_gate_readonly.sql`, executada na branch Neon descartável `br-holy-term-b6v6ofea`. Usa apenas catálogos de permissões e funções, sem acessar dados pessoais, sem alterar grants/DDL/DML:

| Evidência | Resultado |
| --- | ---: |
| Tabelas auditadas `rodizios` / `rodizio_itens` | 2 |
| Tabelas com DML direto para `authenticated` | **2** |
| Tabelas sem RLS | 0 |
| RPCs versionadas ausentes/sobrecarregadas | 0 |
| RPCs versionadas sem EXECUTE `authenticated` | 0 |
| RPCs versionadas expostas a `anonymous` | 0 |
| RPCs versionadas ainda `SECURITY INVOKER` | **7** |
| RPCs versionadas sem `search_path` fixo | 0 |
| RPC legada sem OCC instalada | **1** |
| RPC legada executável por `authenticated` | **sim** |
| Gate `direct_dml_closed` / `legacy_authenticated_closed` | **false / false** |

**Classificação:** bloqueio P0 de integridade concorrente antes de produção. A existência de RLS e os sete endpoints versionados **não eliminam** a possibilidade de um Admin contornar a revisão via DML direto ou RPC legada. O resultado agrega o estado atual, não autoriza executar SQL corretiva.

A sequência de mudança continua exigindo proposta **coordenada e revisada** de funções, identidade/perfil, grants e testes JWT/OCC, no ambiente descartável somente mediante autorização específica. Não remover direitos de tabela sem simultaneamente resolver a dependência `SECURITY INVOKER`; não converter automaticamente para DEFINER sem auditoria de privilégios, search_path e verificação de usuário. Proteger em CI via `tests/neon-write-surface-full.test.mjs`. Uma checagem estática de consulta sem mutação **não equivale** a fechar o gate funcional.
