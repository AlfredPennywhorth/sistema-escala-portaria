# SQL13 — matriz de fixtures verificadas

Branch exclusiva br-little-hill-b6q7979y. Endpoint ep-sparkling-frog-b6k2wvw7 bloqueado após inventário. Não executar na HML canônica. Todas as fixtures abaixo têm títulos de teste e foram verificadas por SELECT.

| Cenário | Fixture (sufixo UUID 00000000-0000-4000-8000-000000000xxx) | Pré-condição | Esperado |
|---|---|---|---|
| OCC em publicado | 203 | publicado, não travado, rev 0, 3 itens; enviar rev 1 divergente | P0001, estado idêntico; revisão futura divergente, não simulação de editor obsoleto |
| Proteção RLS histórico | 206 | travado, rev 2; enviar rev 2 | P0002, histórico idêntico; não comprova ordem OCC |
| Publicado | 203 | publicado, rev 0, 3 itens | 42501 com rev 0 |
| Negativa perfil | 205 | rascunho rev 0, 1 item | 42501 por perfil; confirmar por leitura Admin |
| FK inválida | 205 | rascunho rev 0, 1 item; auxiliar inexistente | 23503 e rollback integral |
| Positivo | 205 | rascunho rev 0, 1 item | retorno 1, rev 1, item correto |
| Concorrência | 202 | rascunho rev 0, 1 item | dois Admins, mesma revisão, exatamente um sucesso e P0001 |

Payload válido: data 2026-12-15, porta Entrada, auxiliar_id null, observacoes TESTE SQL13. Antes de teste, confirmar título, estado, intervalo, revisão e itens; após teste, reconciliar. Se ACK incerto, não repetir. Nenhum teste de escrita nesta rodada.

Cliente atual NeonRpcBranchHomologacao.tsx aponta hardcoded à branch antiga. Build canônico também aponta à HML principal, SQL06=false. Não mudar esses caminhos. Preparar cliente exclusivo sem dependência CDN, com origem explícita, sem tokens nos logs. Não usar CORS como autorização. Segundo Admin independente e autenticação real ainda pendentes.

Revisão Codex P2: SQL13 SECURITY INVOKER usa SELECT FOR UPDATE, sujeito à policy UPDATE que exclui histórico travado. A prova de revisão divergente usa publicado não travado; após SQL12 repetir cenário histórico com JWT real. CI anterior 46076674947: 158/158, ESLint aprovado. Novo CI necessário.
