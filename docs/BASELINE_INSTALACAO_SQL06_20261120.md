# SQL 06 — Baseline pré-instalação e autorização, 20/11/2026

## Autorização e limites
Usuário autorizou expressamente **instalação da SQL06 exclusivamente** no projeto Neon `blue-sky-02214231`, branch descartável `br-holy-term-b6v6ofea`, banco `rodizio_portas`, depois da conferência do CI, revisão técnica e registro do estado das fixtures. Não autorizou mutações na HML principal, Neon main, banco Supabase original, produção ou merge da PR #2. Não autorizou testes destrutivos sobre fixtures existentes.

## Gates verificados ANTES da instalação
- PR #2 draft, sem merge, código `806f3d45e9ac5dc6ea89dc1377392add9e5e368e`.
- CI `44823074666`: **completed/success** para o HEAD.
- Arquivo-fonte SQL06 `migration/neon/06_remaining_admin_mutations_PROPOSAL.sql` revisado, blob SHA `42d752306a43681f8f875474b7fac46c0858aadd`.
- Branch `br-holy-term-b6v6ofea`: `default=false`, `primary=false`, `protected=false`, parent `br-late-night-b6pydxvn`. Não utilizar branch parent.
- Estruturas confirmadas: `rodizios` status CHECK `rascunho|publicado|travado|cancelado`, coluna `revisao bigint NOT NULL DEFAULT 0`. `rodizio_itens.rodizio_id` tem FK `ON DELETE CASCADE`. Gatilhos habilitados `trg_bloquear_itens_travados` e `trg_bloquear_rodizio_travado`.
- Quatro assinaturas SQL 06 não instaladas por `to_regprocedure` (todas NULL). Contagens antes: **7 escalas, 7 itens, 2 auxiliares, 0 restrições**.
- Revisão técnica: as quatro funções exigem JWT/admin via funções de sessão, `SECURITY INVOKER`, `SET search_path=''`, permissões `EXECUTE` restritas a authenticated (sem anonymous), não alteram DML direto preexistente. Operações de edição/cancelamento/exclusão com `FOR UPDATE`, versão esperada e rejeição por estado; criação só de rascunho com revisão 0. SQL06 **não fecha bypass** existente; não confundir instalação com homologação de permissões reais por JWT.
- Limitação conhecida: criação de rascunho ainda não idempotente em falha de transporte pós-commit; interface permanece desconectada.

## Snapshot do conteúdo das fixtures antes da instalação
| ID sufixo | Título | Status | Travado | Revisão | Itens | Observações |
|---|---|---|---|---|---:|---|
| 202 | TESTE FICTICIO RASCUNHO | rascunho | false | 0 | 1 (item 303) | Apenas branch homologação |
| 203 | TESTE FICTICIO PUBLICADO | publicado | false | 0 | 3 (itens 301, 302, 304) | Apenas branch homologação |
| 204 | TESTE FICTICIO TRAVADO | travado | true | 0 | 0 | Apenas branch homologação |
| 205 | TESTE FICTICIO RPC JWT BRANCH TEMPORARIA | rascunho | false | 0 | 1 (UUID 705c1c14-a67c-4afb-a91c-3c5ffb66e1a9) | Somente branch descartável |
| 206 | TESTE FICTICIO TRANSICAO OCC COM ITEM | travado | true | 2 | 1 (item 306) | travado_em 2026-11-20T20:35:58.109Z |
| 207 | TESTE FICTICIO TRANSICAO OCC SEM ITEM | rascunho | false | 0 | 0 | FICTICIO HOMOLOGACAO SQL 05 |
| 208 | TESTE FICTICIO NEGATIVA TRAVAMENTO JWT | publicado | false | 0 | 1 (item 308) | APENAS TESTE AUTORIZACAO SQL 05 |

Snapshot completo dos sete cabeçalhos e dos sete itens foi consultado diretamente por `SELECT` SQL, com dados e timestamps, antes da instalação. Os registros 206, 207 e 208 devem ser preservados; não repetir T01/T04.

## Escopo de implantação autorizado
Executar em transação única os **quatro CREATE OR REPLACE FUNCTION** e os **quatro REVOKE e quatro GRANT** correspondentes, copiados do arquivo SQL06 verificado, sem alterações na definição e sem outras instruções. Conferir assinaturas, flags SECURITY INVOKER e privilégios após COMMIT. Reconciliar contagens, revisões, estado e itens com este snapshot. Sem testes de mutação de fixtures até novo gate de homologação.

**Estado deste documento:** registro pré-instalação; os resultados pós-instalação devem ser acrescentados em seção separada.
