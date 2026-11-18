# Gates e plano de migração funcional Supabase → Neon — 18/11/2026

## Escopo e segurança
PR #2 `chore/neon-migration-prep-20261115` é **somente homologação**. Banco Neon HML `blue-sky-02214231` / `br-late-night-b6pydxvn`; Pages isolado `rodizio-portaria-neon-hml`. Manter `master`, Supabase original e produção intactos. Não importar contas, credenciais ou dados reais até gate de aprovação explícita.

## Evidências aprovadas
- Neon Auth/OTP com três contas HML: `auxiliar`, `coordenadora` e `admin`; sessões e leitura RLS por perfil.
- Auxiliar: tentativa de INSERT em restrições negada por SQLSTATE 42501.
- Coordenadora e Admin: INSERT de restrição fictícia autorizado e DELETE confirmado; banco conferido com 0 resíduos.
- Admin: SELECT de 3 escalas, incluindo 1 rascunho e histórico travado.
- UPDATE idempotente em escala fictícia travada, com JWT Admin: **0 linhas afetadas por RLS**, antes/depois idênticos. **Gatilho NÃO exercitado com esse JWT**; não classificar gatilho como aprovado nesse cenário.
- CI #49 aprovado em `a4844da`, CI #50 aprovado em `fcdb126`. Logout com erro do provedor e sessão posterior verificada: correção de classificação aplicada em `fcdb126`, ainda sem homologação funcional do novo comportamento.

## Bloqueios de integridade encontrados na auditoria do código legado
1. `src/services/rodiziosService.ts`, `registrarHistoricoRealizado`: se já existe histórico `travado=true`, executa `DELETE FROM rodizio_itens` e tenta inserir novamente. Isso entra em conflito com a proteção RLS de itens travados e o gatilho `trg_bloquear_itens_travados`. **Não transportar essa rotina literalmente ao Neon.** Definir uma política de histórico imutável com tratamento idempotente/revisão controlada em fluxo novo antes de habilitar escrita.
2. `registrarHistoricoRealizado`: ao criar um histórico novo, tenta criar `rodizios` já com `status=travado`, `travado=true` antes de inserir itens. O caminho de edição posterior fica bloqueado pelas políticas de itens travados. Exigir preparação dos itens antes de travar, com atomicidade e compensação documentadas, ou um procedimento transacional controlado em servidor.
3. `src/services/rodiziosService.ts`, `salvarItensRodizio`: remove todos os itens e reinsere. Deve ser avaliado para garantir atomicidade (falha na segunda etapa pode perder escala), autorização e preservação de históricos. Não executar sobre registros travados.
4. `src/services/rodiziosService.ts`, `publicarRodizio`: permite publicação de rodízio não travado. Política atual do Neon também permite UPDATE de `publicado` não travado. **Decisão de negócio pendente:** publicação impede edição ou só o travamento? Não alterar políticas sem aprovação.
5. As queries legadas usam `supabase` diretamente e por vezes joins/filtragens específicos; a sintaxe e o comportamento precisam ser validados no `@neondatabase/neon-js` da HML, incluindo RLS por JWT, paginação e tratamento de zero registros.

## Inventário de serviços e sequência proposta
| Ordem | Serviço legado | Tarefas antes da substituição |
|---|---|---|
| 1 | `src/services/areaAuxiliarService.ts` | Adaptar leituras de escala/minhas datas; filtrar status no banco; validar sessão real, RLS e joins |
| 2 | `src/services/auxiliaresService.ts` | Adaptar listas e busca por ID; depois escrita admin com fixtures e transação segura |
| 3 | `src/services/restricoesService.ts` | Migrar filtros e listar; escrita CRUD de fixtures e limpeza verificada; UPDATE ainda não homologado |
| 4 | `src/services/rodiziosService.ts` | Consultas e detalhes; preservar bloqueios; só depois criação, publicação, itens, travamento e histórico em fluxo transacional adequado |
| 5 | `src/services/authService.ts`, `src/hooks/useAuth.ts` | Trocar camada de sessão após validação dos fluxos de OTP/logout/recuperação, mapeamento de usuários e LGPD |

## Gates ainda obrigatórios
- Homologar logout revisado com erro de provedor e verificação posterior; provar acesso negado após saída e ausência de JWT.
- Preparar fixture de **item** em histórico travado usando branch temporária controlada: snapshot/baseline; inserir item ANTES de travar a escala fictícia; testar tentativas de UPDATE/DELETE e verificar invariância; descartar branch. Não arriscar criar item em escala HML travada e depois ficar impedido de removê-lo.
- Testes negativos Coordenadora/Auxiliar em rodízios, itens e vínculos e testes Admin permitidos em rascunhos.
- Resolver regra de edição de escala publicada não travada.
- Concluir migração funcional das telas sem impactar `master`, e plano de transferência/verificação de dados e rollback.
- Somente após todos os gates, solicitar autorização separada para promover a produção.

## Estado
Testes de identidade e CRUD restrições fictícias concluídos nos limites acima. A migração funcional do aplicativo **não está concluída**; não interpretar a régua de avanço como porcentagem de dados migrados.
