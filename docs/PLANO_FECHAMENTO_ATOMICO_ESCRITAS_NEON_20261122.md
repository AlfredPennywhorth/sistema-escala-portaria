# Plano P0 — fechamento coordenado de DML direto e RPC legada no Neon

**Data da análise:** 22/11/2026 (SP). **Estado: PROPOSTA, NÃO EXECUTADA.** Somente código e consultas de catálogos na branch Neon descartável `br-holy-term-b6v6ofea`. Não aplicar no banco antes de revisão independente e autorização específica. Não incluir este arquivo em qualquer execução automática de migrações.

## Evidência verificada em 22/11

A consulta SQL `migration/neon/tests/11_write_surface_full_gate_readonly.sql` comprovou na branch descartável:
- 2/2 tabelas `rodizios` e `rodizio_itens` com INSERT/UPDATE/DELETE diretos permitidos a `authenticated`; RLS ativa nas duas.
- 7/7 RPCs administrativas versionadas instaladas, com `SECURITY INVOKER` e `SET search_path=''`, EXECUTE em `authenticated`, não em `anonymous`.
- RPC antiga `substituir_itens_rodizio_rascunho(uuid,jsonb)` instalada e EXECUTE para `authenticated`.
- As sete RPCs checam `usuario_atual_id()` e `usuario_tem_perfil('admin')` antes de escrever. A leitura das definições confirmou `FOR UPDATE` para as seis RPCs que operam rodízios existentes; criar rascunho insere linha nova com `revisao=0`.
- Funções auxiliares `usuario_atual_id()` e `usuario_tem_perfil(text)` são `SECURITY DEFINER` com search_path fixo; a primeira chama `auth.uid()`. Isso não elimina a necessidade de revisar a identidade reivindicada e permissões do executor em Neon Auth.

## Objetivo e invariantes

Nenhum cliente web autenticado poderá executar INSERT/UPDATE/DELETE diretamente sobre `public.rodizios` ou `public.rodizio_itens`. Escritas legítimas ocorrerão somente por RPCs versionadas, transacionais, com validação explícita de JWT/identidade/role `admin`, revisão esperada quando aplicável, estado válido e respeito ao histórico travado. `anonymous`, usuários sem vínculo, `auxiliar` e `coordenadora` não poderão escrever escalas. RLS e SELECT necessários ao app continuam íntegros.

**Não executar `REVOKE` isolado:** as sete RPCs são hoje SECURITY INVOKER; revogar DML antes de adequá-las quebra operações legítimas. **Não converter para DEFINER sem auditoria**: pode contornar RLS, exigir checagem interna explícita e conceder privilégios excessivos.

## Proposta de implementação em transação única — somente desenho

1. **Pré-condições e janela de manutenção (P0):** branch descartável identificada por projeto/branch/DB; snapshot/rollback da própria HML; CI verde e revisão técnica; autorização expressa para DDL e alteração de grants *apenas* nessa branch. **Antes de coletar o snapshot/inventário de corte, suspender a admissão de TODAS as novas escritas**: tela HML, Data API direta, RPC legada, RPCs versionadas, clientes antigos, automações e qualquer conexão com privilégios. Um simples bloqueio do botão na interface não basta; verificar todos os ingressos e estabelecer barreira operacional efetiva. **Drenar chamadas já aceitas e transações em andamento**, inclusive DML direto e RPC legada: consultar atividade/transações e locks em `pg_stat_activity`/`pg_locks` no banco/branch exatos, identificar sessões antigas, aguardar conclusão ou tratar individualmente sessões bloqueadoras com autorização; não encerrar conexões indiscriminadamente. Registrar início do bloqueio, responsáveis, sessões pendentes, conclusão da drenagem e evidências de zero escritores ativos. Se não for possível impedir ou observar todos os escritores, **NO-GO, sem executar migração**. Só depois obter inventário/snapshot consistente, preservando a suspensão até a validação completa do pacote. Inventariar `pg_get_functiondef`, `pg_get_userbyid(proowner)`, `proacl`, `pg_default_acl`, grants das tabelas e `pg_policies`; reconferir consumidores e privilégios do proprietário. A proposta `migration/neon/04_optimistic_revision_drafts_PROPOSAL.sql` já exige lock de manutenção durante rollout; este plano incorpora explicitamente esse requisito.
2. **Preparar RPCs controladas:** manter as sete assinaturas e semânticas; revisar cada função como `SECURITY DEFINER` com `SET search_path=''` e referências a schemas explícitos. Revalidar identidade assinada de Neon Auth no contexto real (não confiar em headers fornecidos pelo navegador), checar perfil dentro de cada função, garantir atomicidade `FOR UPDATE`, `revisao` e `P0001`, validar estados e travas. Garantir owner sem `BYPASSRLS` quando viável; quando RLS for inevitavelmente contornada pela função, a autorização interna precisa ser suficiente, revisada e testada. Evitar helpers públicos adicionais com poderes de escrita. Avaliar mecanismo de ownership e invocação permitido na Data API do Neon.
3. **Implantação controlada (janela ainda bloqueada para escrita):** após confirmar a drenagem, obter bloqueios de manutenção adequados nas tabelas críticas e evitar concorrência entre a verificação final de ausência de escritores e o início da transação; conferir timeout de locks e abortar caso outra escrita apareça. Numa única transação revisada, alterar/substituir as sete funções e seus proprietários/privilégios conforme desenho aprovado; revogar explicitamente DML de `PUBLIC`, `anonymous`, `authenticated` e outras roles de acesso direto pertinentes, considerando grants por herança; revogar EXECUTE da RPC legada de `PUBLIC`, `anonymous` e `authenticated`; garantir EXECUTE das sete RPCs somente ao papel apropriado de API e o mínimo SELECT requerido. Inspecionar default privileges para impedir reabertura acidental. **Não incluir SQL DDL neste documento**, para impedir aplicação parcial por cópia.
4. **Validação ainda na transação onde possível (sem reabrir escritas):** executar inspeção de grants/funções e invariantes estáticos; criar savepoints/rollback para provas que alterariam dados fictícios, lembrando que testes de JWT via Data API real exigem conexões externas após commit. Se o conjunto de funções/grants não estiver íntegro, executar ROLLBACK. Não considerar catálogo consistente como prova de comportamento.
5. **Ensaios pós-commit apenas na HML, com suspensão mantida para clientes antigos:** liberar acesso controlado somente aos clientes de teste autorizados e às sete RPCs atualizadas; não restaurar o tráfego normal antes de concluir todas as negativas de DML direto/RPC legada e a reconciliação. Tokens reais Admin/Auxiliar e sem JWT. Admin consegue sete operações; sem JWT, Auxiliar e Coordenadora não conseguem; Admin não consegue DML direto nas duas tabelas nem invocar RPC legada. Confirmar controle `P0001` para revisão vencida, dois clientes concorrentes, rollback integral em FK inválida, travas de históricos e resposta indeterminada após perda de ACK (nunca repetir cegamente).
6. **Comparação de dados fictícios e liberação controlada:** comparar antes/depois com a janela de escrita ainda suspensa; liberar clientes operacionais somente após validação do pacote, prova de que conexões antigas não conseguem gravar e assinatura do gate. Se qualquer verificação falhar, manter suspensão e acionar rollback documentado. Verificar contagens/PKs/FKs antes e depois, `revisao` monotônica, registros travados idênticos e sem diferença inesperada. `migration/neon/tests/11_write_surface_full_gate_readonly.sql` deve retornar `tables_with_direct_dml=0`, `direct_dml_closed=true`, `legacy_authenticated_closed=true` e `versioned_rpc_not_all_definer=0`. Isso é condição necessária, **não suficiente** para GO.
7. **Reversão com janela bloqueada:** preservar versão exata das funções, owner, GRANT/REVOKE e RLS antes da execução; praticar retorno em branch descartável. Reverter o pacote completo, não apenas grants. Não fazer rollback tentando escrever no Supabase original, no Neon main ou em histórico travado.

## Matriz mínima de aceitação

| Ator/cenário | Esperado | Evidência |
| --- | --- | --- |
| Janela de manutenção e drenagem de escritores antigos | Zero transações escritoras remanescentes antes do snapshot e do DDL; nenhuma nova escrita admitida até a validação | Registro do bloqueio nos ingressos, `pg_stat_activity`/`pg_locks`, snapshot e horário de reabertura |
| Sem JWT: chamadas de leitura e mutação restritas | Mutação 401/403 ou SQLSTATE 42501, conforme API | Resposta completa + estado inalterado |
| Auxiliar com JWT | Sem mutação nas escalas | JWT HML + estado inalterado |
| Coordenadora com JWT (se existir) | Sem mutação nas escalas | JWT HML + estado inalterado |
| Admin JWT, RPC versão válida | Uma alteração + incremento único de revisão | Registro/itens antes/depois |
| Admin JWT, revisão vencida | P0001, sem alterações | Estado/itens originais |
| Admin JWT, DML REST direto | Rejeitado (mesmo se escala é rascunho) | Status + ausência de alterações |
| Admin JWT, RPC antiga | Rejeitada/indisponível | Status + ausência de alterações |
| Admin JWT, alterar histórico travado | Rejeitado | Histórico intocado |
| Dois Admins simultâneos | Uma gravação aceita, outra P0001 | Revisões e itens reconciliados |
| Timeout depois do commit | Não há repetição automática; leitura de confirmação | Reconciliação por ID/revisão |
| Falha de FK durante substituição | ROLLBACK total | Itens e revisão preservados |

## Bloqueios e escopo

- **Pré-condição formal P0 do Codex:** suspender novas escritas, drenar transações existentes, obter snapshot somente após a drenagem, manter suspensão até a validação. Sem ela, uma transação previamente autorizada pode gravar sem OCC mesmo se a alteração de grants ocorrer em transação única.
- **Sem autorização para aplicar migração SQL nem mudar grants nesta etapa.** O usuário autorizou somente trabalho de código/documentação e inventários de leitura; o banco de origem é estritamente read-only.
- O backup restaurável da origem Supabase segue pendente para execução em computador. Não transferir dados reais antes do gate do backup.
- A interface operacional ainda precisa ser conectada ao Neon isolado; os módulos de teste SQL06 não representam produção.
- A migração de identidades (4 vínculos, 3 usuários distintos) e dos 8 itens históricos de julho exige runbook próprio, sem alterar origem.
- Codex/CI sem achados críticos em documentação **não validam** uma futura implementação de SECURITY DEFINER: exigir revisão nova específica do SQL final e teste de JWT real após aplicação controlada.

## Fontes internas

- `docs/GATE_FECHAMENTO_ESCRITAS_NEON_20261120.md`
- `migration/neon/tests/06_write_surface_audit_readonly.sql`
- `migration/neon/tests/11_write_surface_full_gate_readonly.sql`
- `docs/AUDITORIA_COMPATIBILIDADE_SCHEMA_SUPABASE_NEON_20261121.md`
- `docs/GO_NO_GO_CHECKLIST_20261129.md`

## SQL proposta para revisão, ainda sem executar — 22/11

- Arquivo: `migration/neon/12_atomic_write_surface_hardening_REVIEW_ONLY.sql`.
- **NÃO EXECUTAR:** sua execução exige autorização separada de alteração dos privilégios na branch descartável, janela de drenagem e snapshot de HML. Não integrar a deploys, nem aplicar na origem Supabase ou Neon main.
- A transação usa `LOCK TABLE ... ACCESS EXCLUSIVE`, `lock_timeout`, verificações de owner, RLS, número de RPCs, path seguro e pós-validação. Uma divergência gera erro e rollback.
- **Bloqueio intencional:** a definição SQL04 atualmente instalada na HML compara estado/trava antes da revisão; o preflight recusa o pacote até instalação e homologação da variante OCC revision-first, separadamente autorizada. Isso é condição funcional antes de trocar privilégios.
- O pacote altera apenas atributos `SECURITY DEFINER` das sete RPCs versionadas, seus grants e os GRANT/REVOKE das duas tabelas e RPC legada; não muda corpo da função, não insere/deleta dados e não migra identidades.
- Mesmo com checagem de proprietário, `SECURITY DEFINER` pode contornar RLS. Validar **identidade JWT real**, defesa contra claims adulteradas e funções auxiliares antes de autorizar execução. A confirmação por CI/testes estáticos não prova segurança operacional.
- Teste `tests/neon-write-hardening-proposal.test.mjs` e workflow só analisam texto; **nunca executam o SQL**. Solicitar revisão específica do Codex e, após ajustes, preparar ensaio de manutenção na branch descartável com aprovação explícita.

## Correção dos achados Codex P1/P2 — 22/11/2026 (somente proposta)

Na revisão do commit `bdee287683`, Codex identificou:
- **P1:** `REVOKE` de DML no nível de tabela não elimina grants de INSERT/UPDATE por coluna. O postflight anterior, com apenas `has_table_privilege()`, poderia aprovar falsamente um Admin ainda apto a escrever sem OCC.
- **P2:** `NOT (p.proconfig @> ...)` retorna `NULL` quando `proconfig` é `NULL`, permitindo elevar uma RPC sem `search_path` fixo para `SECURITY DEFINER`.

Correção **no SQL review-only, não executado**:
- Postflight verifica também `has_any_column_privilege('authenticated'|'anonymous', c.oid, 'INSERT'|'UPDATE')`, além de `has_table_privilege`; a verificação de privilégio efetivo considera herança de roles. **Com grant residual por coluna, aborta a transação inteira**. A proposta não tenta revogar cegamente grants por coluna: a presença deles exige inspeção e correção explícita antes da aplicação.
- Preflight e postflight das sete RPCs usam `(p.proconfig @> ARRAY['search_path=""']::text[]) IS NOT TRUE`, rejeitando falso e nulo.
- Testes estáticos atualizados em `tests/neon-write-hardening-proposal.test.mjs` e `tests/neon-write-surface-full.test.mjs`.
- Preflight `migration/neon/tests/11_write_surface_full_gate_readonly.sql` inclui `tables_with_effective_column_dml` e exige ausência de permissões efetivas por coluna para `direct_dml_closed=true`.

Execução **somente leitura** da auditoria atualizada na branch descartável confirmou: `tables_found=2`, `tables_with_direct_dml=2`, `tables_with_effective_column_dml=2`, `direct_dml_closed=false`, `legacy_authenticated_closed=false`. Isso demonstra o gate ainda aberto, mas **não demonstra a existência de grants exclusivamente por coluna**, pois privilégios de tabela também conferem privilégios efetivos de coluna. Será necessário inventariar `pg_attribute.attacl` e `pg_auth_members` antes da implantação. Nada foi alterado no banco.

**Critério de avanço:** CI verde, nova revisão Codex sem bloqueios, correção SQL04, janela de suspensão/drenagem, autorização de DDL só na branch descartável e JWT real. Não realizar merge nem deploy de produção.

## Preparação SQL04 revision-first — 22/11/2026

A definição **instalada na branch descartável** foi reaberta por consulta read-only `pg_get_functiondef` e comparada com `migration/neon/04_optimistic_revision_drafts_PROPOSAL.sql`:
- Instalada: `IF v_travado OR v_status <> 'rascunho'` **antes** de `IF v_revisao_atual IS DISTINCT FROM p_revisao_esperada`. Em editor obsoleto após publicação/travamento, pode devolver `42501` por estado em vez de `P0001` por revisão.
- Proposta canônica do repositório: sob o mesmo `FOR UPDATE`, **revisão primeiro**, estado depois, e `DELETE/INSERT` só após os dois controles. Mantém transação única e incremento de `revisao` após gravar itens.
- Preparado **somente como código review-only** `migration/neon/13_sql04_revision_first_REVIEW_ONLY.sql`: contém exatamente a definição da RPC proposta no arquivo 04, sem seu `ALTER TABLE`, sem alteração de grants, identidade, SQL05/SQL06 ou dados. Transação com `lock_timeout`, maintenance LOCK, preflight verificando estado instalado esperado, owner, invoker e `search_path`, e postflight verificando ordem/atributos; divergências abortam com rollback.
- Teste independente `tests/neon-sql04-revision-order.test.mjs` verifica igualdade do corpo com o arquivo 04, ordem `FOR UPDATE → revisão → estado → DELETE`, proteção de função e gates. Executado no CI como **análise estática**, nunca SQL no banco.
- **Ainda pendente:** revisão específica do Codex, autorização explícita para DDL na branch descartável, suspensão/drenagem efetiva de escritas, snapshot da HML, execução controlada e prova com JWT Admin real de `P0001` quando a revisão vista pelo editor está obsoleta versus `42501` quando a revisão é atual e o estado é inválido. Um CI verde não aprova a execução.
- O pacote SQL12 de fechamento de DML/legada permanece bloqueado até essa correção estar instalada e homologada. Não aplicar SQL12 imediatamente após SQL13 sem os testes intermediários e a autorização específica de cada gate.

## Revisão Codex 756842e62a — correções de baseline completa e teste (22/11/2026)

O Codex apontou dois problemas P2 na proposta SQL13: a comparação de apenas duas substrings não detectava mudanças em outras validações da RPC e o teste de drenagem usava a expressão `drenar transacoes`, enquanto o SQL continha `drenagem de transacoes`.

**Ajustes feitos, somente no repositório:**
- Arquivo review-only `migration/neon/13_sql04_revision_first_REVIEW_ONLY.sql`: o preflight agora compara **todo** o `pg_proc.prosrc` com a baseline exata de corpo instalado, MD5 `b06899977f63be59f8c993b05d134498`. Qualquer alteração extra, inclusive comentários/espaçamento, aborta com erro. Confere também proprietário, `SECURITY INVOKER`, `search_path`, linguagem PL/pgSQL, tipo de retorno e volatilidade. O postflight exige o fingerprint integral da versão revision-first, MD5 `f2100180626d8fd8881aebb99ca57d0d`; o fingerprint inclui newline terminal do corpo PL/pgSQL.
- Baseline de corpo instalada capturada por **consulta somente leitura** à branch descartável e preservada em `migration/neon/tests/fixtures/sql04_installed_state_first_baseline.sql.txt`, sem credenciais/dados pessoais.
- `tests/neon-sql04-revision-order.test.mjs`: valida a igualdade integral do corpo canonical com a proposta, os dois fingerprints e um **teste negativo** que insere deriva funcional extra mantendo ambos controles e verifica falha do hash. Aceita a expressão real `drenagem de transacoes`.
- A única diferença semântica normalizada verificada entre corpo instalado e arquivo canônico SQL04 é a inversão dos dois blocos `estado` e `revisão`. Os fingerprints são **estritos**, não uma equivalência por normalização permissiva.
- A verificação por MD5 é uma salvaguarda contra **drift acidental** na versão instalada e não substitui revisão humana, controle de alterações, autenticação, teste de comportamento ou autorização do rollout. Se o corpo instalado mudar antes da implantação, o script deve falhar e a baseline deve ser revisada, jamais atualizada automaticamente para passar.
- **Não foi executada nenhuma DDL/DML.** SQL13 e SQL12 continuam propostas não aplicadas. O resultado de CI e a revisão incremental do Codex devem ser reconfirmados no SHA mais novo antes de solicitar autorização específica da janela HML.
