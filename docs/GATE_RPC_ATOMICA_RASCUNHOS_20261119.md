# Gate da RPC de substituição atômica de rascunhos — 19/11/2026

## Situação
**Proposta não aplicada ao Neon. Serviço ainda não conectado ao runtime nem à tela HML.**
- SQL: `migration/neon/03_atomic_draft_items_PROPOSAL.sql`
- Adaptador HML: `src/services/neon/rodizioDraftWriteService.ts`
- Commit da correção P1: `8c5ad7490051d41d2817c2cb4b123555bed5cc2d`
- Motivo da RPC: `src/services/rodiziosService.ts` legado exclui todos os itens e os reinsere em duas chamadas independentes, arriscando perda parcial.

## Requisitos obrigatórios para execução
1. Branch descartável criada a partir de HML, **não** a branch principal e nunca produção.
2. Aprovação explícita para aplicar SQL e gravar fixtures somente nessa branch.
3. Garantir que `public.usuario_atual_id()` funciona com JWT e `authenticated` sem USAGE em `auth`.
4. Conferir `SECURITY INVOKER`, `GRANT EXECUTE` apenas para `authenticated`, RLS e gatilhos ativos.
5. Registrar baseline de cada escala e de cada item antes de começar, e conferir contagens/integridade após cada teste.
6. Não adicionar fallback DELETE+INSERT em solicitações separadas.
7. Não executar testes de erro na produção, nem em histórico travado com dados de uso real.

## Matriz de integração obrigatória, após autorização de aplicação
| Caso | Identidade | Entrada | Esperado |
|---|---|---|---|
| A | Admin JWT | Rascunho não travado, 2 itens válidos | Substituição atômica, total=2, dados exatos |
| B | Admin JWT | Segundo item com auxiliar UUID inválido / fora de período | Erro e preservação integral do estado anterior |
| C | Admin JWT | Escala publicada | Negativa, antes/depois idênticos |
| D | Admin JWT | Escala travada | Negativa, antes/depois idênticos |
| E | Auxiliar JWT | Rascunho | Negativa, sem alteração |
| F | Coordenadora JWT | Rascunho | Negativa, sem alteração |
| G | Sem JWT | Rascunho | Negativa, sem alteração |
| H | Admin JWT | Itens vazios ou mais de 500 | Erro de validação, sem alteração |
| I | Admin JWT | Duas substituições concorrentes | Sem mescla ou perda parcial; resultado serializado |
| J | Admin JWT | Falha de transporte após envio | Não repetir cegamente; reconciliação com SELECT |

## Critérios de aceitação
- Todo erro após o DELETE interno faz rollback da transação completa, sem escala parcialmente vazia.
- Em nenhuma hipótese itens de escala travada são alterados.
- Nenhuma concessão de acesso ao schema `auth` ao papel `authenticated`.
- Identidade/autorização garantidas no banco; verificações do frontend são auxiliares.
- Evidências de JWT, SQLSTATE, contagem dos itens, CI e revisão Codex arquivadas na PR #2.
- Depois dos testes, descartar apenas a branch de banco temporária mediante autorização separada.

## Gates de produção
Ainda pendentes: regras sobre editar escala publicada, histórico realizado imutável, importação reconciliada de usuários e dados reais, backup restaurável, testes com volume e rollback, homologação da navegação normal. A PR #2 permanece draft e não autoriza cutover.
