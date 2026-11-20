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
