# Homologação enxuta — dois operadores de rodízios (21/11/2026)

## Premissa de negócio informada
O usuário informa que apenas dois operadores geram rodízios no sistema: **Administrador** e **Coordenadora**. Minimizar provas manuais, preservando garantias de integridade.

## Divergência verificada no sistema
- Em `src/components/RodizioAdmin.tsx`, o acesso ao módulo administrativo exige `isAdmin`. A geração do algoritmo é separada da persistência.
- Em `supabase/schema.sql`, a política de `rodizios` autoriza **somente admin** a inserir/atualizar/excluir; `coordenadora` aparece na administração de **restrições**, não na gravação de rodízios.
- Na branch Neon descartável `br-holy-term-b6v6ofea`, as RLS de `rodizios` e `rodizio_itens` exigem `usuario_tem_perfil('admin')` para INSERT/UPDATE/DELETE. As quatro RPCs SQL06 também validam expressamente esse perfil. Portanto, **não afirmar que Coordenadora pode persistir um rodízio** antes de decisão de regra e implementação separada.
- O usuário pode estar se referindo à **geração de sugestões pelo algoritmo**, sem gravação. Confirmar a regra de persistência antes de ampliar o acesso. Nunca transformar a Coordenadora em Administrador ou conceder privilégio geral de DML para resolver o problema.

## Provas já homologadas — não repetir
- SQL06: N01–N04 com JWT Auxiliar (negação), P01 (criação), P02 (edição), P05 (cancelamento), P07 (exclusão) com JWT Admin, todos reconciliados no Neon.
- SQL05: publicação/travamento positivo da fixture 206; não repetir.
- P07 removido da interface depois de consumido, assim como P01, P02, P05; a tela retém somente histórico descritivo.

## Nova régua manual mínima (2 operadores)
| Prova manual | Operador | O que valida | Limite |
| --- | --- | --- | --- |
| M1 — fluxo de geração e permissões reais | **Coordenadora** | Login, geração de sugestão, leitura permitida e tentativa controlada de salvar apenas **se** a regra de negócio autorizar | Hoje a gravação é bloqueada. Antes de autorizar persistência, resolver divergência entre regra e RLS/RPC; não repetir N01–N04 |
| M2 — conflito de revisão | **Administrador** | Uma tentativa de editar com revisão antiga numa fixture sintética separada; esperar `P0001` e confirmar nenhuma mudança | Preparar novo ensaio isolado depois de CI, nunca sobre fixture consumida |
| M3 — smoke final de fluxo completo | **Administrador** | Um único ciclo UI criação/geração/salvamento/publicação e proteção do histórico, após migração funcional | Depende da integração real; não executar na tela atual |

## Verificações técnicas sem cliques adicionais
- SELECT/pg_catalog independente de integridade, ausência de sessão, grants, gatilhos, status e revisão.
- Testes automatizados de conflito, validação de parâmetros e proibição de retry. Concorrência real em duas sessões somente se operação simultânea for relevante à regra e não estiver coberta por teste transacional confiável.
- Revogação de DML direto não deve ser feita neste estágio: `SECURITY INVOKER` depende dos grants, e sua remoção isolada quebraria as RPCs. Planejar migração coordenada least privilege.
- SQL06 `criar_rodizio_rascunho_versionado` não oferece chave de idempotência: título de teste é só marcador, não proteção contra duplicação concorrente.

## Baseline atual da branch descartável
10 escalas, 9 itens. Um perfil admin e um perfil coordenadora nos dados de homologação. Grants de INSERT/UPDATE/DELETE na tabela `rodizios` ainda presentes para papel SQL `authenticated`, porém RLS restringe as operações ao Admin; é um desvio arquitetural a fechar, não prova de acesso da Coordenadora.

## Gate de mudança de permissão
Caso Coordenadora precise **salvar** rodízios, formular matriz separada e mínima de criação/edição/publicação/travamento/cancelamento/exclusão; aprovar expressamente o escopo antes de alterar RLS, RPC ou código. Fazer somente testes críticos por operação de risco distinto, sem cenários duplicados. Sem alterações no Neon main, HML principal, Supabase origem ou produção; PR #2 permanece Draft até decisão.

## Decisão posterior do responsável — dois usuários Administradores

O responsável definiu que concederá perfil `admin` à pessoa anteriormente vinculada como `coordenadora`. **Esta é uma decisão prevista, ainda não aplicada por este trabalho**. Após a alteração validada, os dois operadores utilizarão as mesmas RPCs existentes, sem criar permissões paralelas para `coordenadora`.

**Homologação mínima restante:** (1) confirmar por leitura que há dois vínculos de perfil `admin` no ambiente autorizado e autenticar a segunda conta para verificar o JWT `admin`; (2) executar apenas uma prova de conflito de revisão em fixture sintética separada, com reconciliação independente; (3) verificar tecnicamente privilégios DML direto, RPCs legadas, proteção do histórico, dados reais e migração de produção. Não repetir os positivos P01/P02/P05/P07 já homologados.

**Ressalva:** mudar para `admin` amplia também outras capacidades administrativas. A alteração de perfil deve ser feita conscientemente no ambiente pretendido e não deve ser promovida à produção automaticamente. Não atualizar a conta por SQL nesta etapa; o usuário afirmou que realizará a atribuição.

O conjunto anterior de testes da Coordenadora com perfil próprio fica dispensado **somente se** ela efetivamente passar a ter JWT `admin`. Antes da troca, as RLS e RPCs atuais continuam proibindo que o perfil `coordenadora` grave rodízios.
