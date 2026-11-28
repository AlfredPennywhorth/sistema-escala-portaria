# Plano de prontidão para produção — meta 29/11/2026

**Data da avaliação:** 20/11/2026. **Estado:** meta condicional, risco alto. Este documento não autoriza deploy, merge, migração de dados nem mudanças em produção.

## Evidências verificadas
- PR #2 draft, sem merge, HEAD antes deste documento `cd395d39d9a2f356dd0904948876ae9820b9d6e4`.
- CI #93 `Neon Migration Branch Check` verde para esse HEAD (build padrão, build Neon HML/Cloudflare e lint; não substitui E2E).
- Neon descartável `br-holy-term-b6v6ofea`: SQL 05 presente, testes T01/T04/T06 com evidências de interface e reconciliação SQL; T05 de UPDATE em cabeçalho/item travado negado por gatilhos `P0001`, preservação confirmada.
- Neon branch **principal** `br-lively-lab-b69kz252`: `auxiliares=0`, `rodizios=0`, `rodizio_itens=0`, `usuarios_auxiliares=0`. Os dados originais **não estão migrados**.
- A fachada Neon de escrita funcional permanece desconectada da UI operacional; legados ainda acessam Supabase.
- Controle de revisão ainda contornável por DML direto e RPC legada; revogação isolada de DML quebraria `SECURITY INVOKER`.
- Disponibilidade de backup e inventário da origem Supabase **não confirmada** nesta avaliação.

## Caminho crítico com checkpoints (datas-alvo, não promessas)
| Prazo | Entrega e aceite | Gate |
|---|---|---|
| 21/11 | Completar matriz T05 (INSERT/DELETE/movimentação) usando somente fixtures descartáveis, sem quebrar histórico; confirmar negativas com JWT real | Segurança |
| 22/11 | Fechar requisitos de negócio (edição de publicado não travado, cancelamento, histórico); implementar versão segura de todas as escritas, remoção coordenada de bypass, testes de regressão | Integridade |
| 23/11 | T02/T03, concorrência verdadeira T16, erro FK e timeout pós-commit; documentar diferenças de resultados e baseline | Concorrência |
| 24/11 | Integrar serviços Neon de leitura e escrita em UI HML isolada e validar fluxos completos (escala, auxiliar, restrição, histórico, impressão, autenticação) | Funcional |
| 25/11 | Recuperar/acessar origem Supabase; inventário somente leitura, backup restituível, reconciliação de schema, políticas e identidades | **Bloqueio crítico** |
| 26/11 | Migração experimental dos dados para branch Neon isolada, comparação de contagens/FKs/amostras, testes com perfis provisionados e reversão | Dados |
| 27/11 | CI e revisões técnicas verdes, smoke E2E, testes de restauração e rollback/cutover documentados | Qualidade |
| 28/11 | Homologação final, plano de comunicação, aprovação explícita para merge/cutover e janela de publicação | Go/no-go |
| 29/11 | **Somente se todos os gates anteriores estiverem aprovados:** publicação assistida, smoke, reconciliação e rollback pronto | Produção |

## Critérios objetivos de NO-GO
1. Backup da origem inexistente/não restaurável, ou dados/identidades não conciliados.
2. Qualquer gravação capaz de contornar revisão, privilégios ou histórico travado.
3. Concorrência real, fallback de erro de rede ou rollback sem evidência válida.
4. Fluxo funcional Neon da aplicação não integrado, ou falha de autenticação/recuperação sem solução.
5. CI/revisões/aceites pendentes, ou ausência de autorização específica para produção.

**Plano alternativo:** se algum gate não for comprovado até 28/11, não executar cutover em 29/11; preservar o sistema atual, continuar HML e definir nova data a partir do bloqueio real.

## Acompanhamento
Escala de marcos (não confundir com percentual de migração): preparação HML, Auth/RLS inicial, logout, transições básicas concluídas; imutabilidade parcial; negativas/conflitos parciais; fechamento das escritas, integração funcional, dados e release ainda pendentes. O cronograma requer trabalho priorizado e decisões rápidas, mas não justifica reduzir segurança.

**Limites:** nenhuma alteração na `master`, nos bancos de produção ou no Supabase de origem nesta avaliação.
