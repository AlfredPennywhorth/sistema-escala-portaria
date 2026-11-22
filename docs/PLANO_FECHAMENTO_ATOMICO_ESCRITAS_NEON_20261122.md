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

1. **Pré-condições:** branch descartável identificada por projeto/branch/DB; snapshot/rollback da própria HML; CI verde e revisão técnica; autorização expressa para DDL e alteração de grants *apenas* nessa branch. Inventariar `pg_get_functiondef`, `pg_get_userbyid(proowner)`, `proacl`, `pg_default_acl`, grants das tabelas e `pg_policies` imediatamente antes. Reconferir quais funções e APIs efetivamente acessam as tabelas e se o proprietário possui privilégio mínimo.
2. **Preparar RPCs controladas:** manter as sete assinaturas e semânticas; revisar cada função como `SECURITY DEFINER` com `SET search_path=''` e referências a schemas explícitos. Revalidar identidade assinada de Neon Auth no contexto real (não confiar em headers fornecidos pelo navegador), checar perfil dentro de cada função, garantir atomicidade `FOR UPDATE`, `revisao` e `P0001`, validar estados e travas. Garantir owner sem `BYPASSRLS` quando viável; quando RLS for inevitavelmente contornada pela função, a autorização interna precisa ser suficiente, revisada e testada. Evitar helpers públicos adicionais com poderes de escrita. Avaliar mecanismo de ownership e invocação permitido na Data API do Neon.
3. **Implantação controlada:** numa única transação revisada, alterar/substituir as sete funções e seus proprietários/privilégios conforme desenho aprovado; revogar explicitamente DML de `PUBLIC`, `anonymous`, `authenticated` e outras roles de acesso direto pertinentes, considerando grants por herança; revogar EXECUTE da RPC legada de `PUBLIC`, `anonymous` e `authenticated`; garantir EXECUTE das sete RPCs somente ao papel apropriado de API e o mínimo SELECT requerido. Inspecionar default privileges para impedir reabertura acidental. **Não incluir SQL DDL neste documento**, para impedir aplicação parcial por cópia.
4. **Validação ainda na transação onde possível:** executar inspeção de grants/funções e invariantes estáticos; criar savepoints/rollback para provas que alterariam dados fictícios, lembrando que testes de JWT via Data API real exigem conexões externas após commit. Se o conjunto de funções/grants não estiver íntegro, executar ROLLBACK. Não considerar catálogo consistente como prova de comportamento.
5. **Ensaios pós-commit apenas na HML:** tokens reais Admin/Auxiliar e sem JWT. Admin consegue sete operações; sem JWT, Auxiliar e Coordenadora não conseguem; Admin não consegue DML direto nas duas tabelas nem invocar RPC legada. Confirmar controle `P0001` para revisão vencida, dois clientes concorrentes, rollback integral em FK inválida, travas de históricos e resposta indeterminada após perda de ACK (nunca repetir cegamente).
6. **Comparação de dados fictícios:** contagens/PKs/FKs antes e depois, `revisao` monotônica, registros travados idênticos e sem diferença inesperada. `migration/neon/tests/11_write_surface_full_gate_readonly.sql` deve retornar `tables_with_direct_dml=0`, `direct_dml_closed=true`, `legacy_authenticated_closed=true` e `versioned_rpc_not_all_definer=0`. Isso é condição necessária, **não suficiente** para GO.
7. **Reversão:** preservar versão exata das funções, owner, GRANT/REVOKE e RLS antes da execução; praticar retorno em branch descartável. Reverter o pacote completo, não apenas grants. Não fazer rollback tentando escrever no Supabase original, no Neon main ou em histórico travado.

## Matriz mínima de aceitação

| Ator/cenário | Esperado | Evidência |
| --- | --- | --- |
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
