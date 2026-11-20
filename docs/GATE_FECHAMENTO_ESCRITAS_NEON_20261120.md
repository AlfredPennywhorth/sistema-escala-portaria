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
