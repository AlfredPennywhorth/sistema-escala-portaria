# SQL 06 — roteiro de homologação controlada (20/11/2026)

**Estado:** preparado, não executado. Nenhum teste mutante novo está autorizado. A autorização anterior limitou-se à instalação das quatro funções na branch descartável `br-holy-term-b6v6ofea` do projeto `blue-sky-02214231` e banco `rodizio_portas`.

## Situação preservada
- Pré-homologação de leitura SQL06 concluída por JWT Auxiliar e JWT Admin, reconciliação SELECT independente da fixture 206 (travado, rev 2, item 306), 207 (rascunho, rev 0, sem itens) e 208 (publicado, rev 0, item 308).
- Fixtures 202–208 e item legado da fixture 205 não podem ser reutilizados para um positivo, inclusive por clique acidental. Botões T01/T04 e gravação Admin legada desativados no código da tela.
- Conferência somente leitura atual: 7 escalas, 7 itens, 4 funções SQL06 instaladas. Nenhuma revogação de DML direto foi executada.

## Preparação obrigatória para autorizar a próxima rodada
1. Confirmar CI atualizado, HEAD e parâmetros exclusivos da branch descartável; não publicar nenhuma tela SQL06 mutante na HML principal.
2. Criar **novas fixtures sintéticas** só após autorização expressa, com identificadores únicos determinados no momento do provisionamento. **Não usar IDs existentes 202–208**.
3. Para cada fixture, registrar antes: ID, status, travado, revisão, datas, itens e hash/cópia restaurável do baseline. Após cada prova, executar SELECT independente, inclusive verificação de não alteração em 202–208.
4. Nenhum token OTP ou JWT deve entrar em documentos, prints ou logs. Somente perfil, status, SQLSTATE, revisão e contagens.
5. Operação de exclusão precisa de autorização específica para remover somente uma fixture **nova** com seu item sintético; confirmar `ON DELETE CASCADE` e que nenhuma outra fixture foi afetada.
6. Nunca repetir automaticamente `criar_rodizio_rascunho_versionado` após erro de transporte: sem chave de idempotência, reconciliar primeiro por leitura e procurar possível duplicação.
7. Se SQL06 produzir sucesso para uma Auxiliar/Coordenadora ou usuário sem vínculo, **parar imediatamente** e preservar evidências para correção do banco.

## Matriz proposta de provas
| Cenário | JWT | Operação SQL06 | Resultado necessário |
| --- | --- | --- | --- |
| N01 | Auxiliar | criar rascunho | recusa 42501; nenhuma linha nova |
| N02 | Coordenadora | editar cabeçalho | recusa 42501; revisão e título iguais |
| N03 | Auxiliar | cancelar rascunho | recusa 42501; estado intacto |
| N04 | Coordenadora | excluir rascunho | recusa 42501; item preservado |
| N05 | Sem sessão | quatro RPCs | recusa; dados intactos |
| P01 | Admin | criar rascunho | novo UUID, status rascunho, revisão 0 |
| P02 | Admin | editar cabeçalho com versão original | dados alterados, revisão +1 |
| P03 | Admin | editar com versão obsoleta | recusa P0001, sem lost update |
| P04 | Admin | encurtar datas excluindo item | recusa 22023, sem mudança |
| P05 | Admin | cancelar publicado não travado | status cancelado, revisão +1 |
| P06 | Admin | cancelar travado | recusa, histórico preservado |
| P07 | Admin | excluir **apenas fixture nova** com item | exclusão atômica com item, nenhum outro registro afetado |
| C01 | Duas sessões Admin | duas edições com mesma revisão | só uma vence; perdedora P0001 |
| C02 | Admin | timeout/resultado incerto | reconciliação, sem repetição automática |

**Atenção ao alcance:** SQL06 ainda é SECURITY INVOKER e depende dos GRANTs de DML existentes. Mesmo que todos os cenários acima passem, não marcar fechamento de escrita concluído até retirar DML direto e a RPC antiga de forma coordenada, após revisão e testes específicos.

## Critério para iniciar os testes positivos
Requer autorização separada para a criação/alteração/cancelamento/exclusão de novas fixtures fictícias na **mesma branch descartável**; não autoriza qualquer intervenção no Neon main, HML principal ou produção. A execução será granular e interrompida na primeira divergência.

## Execução controlada de preparação — 20/11/2026

O usuário autorizou a continuidade dos ensaios na branch Neon descartável. CI do commit `84f72fb07b3cd21204a97b90dea58810b9178f7c` **aprovado** (`#44851827647`) após correção de TypeScript: botões T01/T04 bloqueados tornaram três testes de tipo inalcançáveis; os ramos antigos foram removidos.

**Baseline anterior preservado:** 7 escalas e 7 itens, fixtures 202–208 sem reutilização. Antes do provisionamento, SELECT confirmou ausência dos UUIDs 209–211. Após o CI verde, foram inseridos em uma única transação, **apenas** em `blue-sky-02214231/br-holy-term-b6v6ofea/rodizio_portas`, três cabeçalhos e três itens sintéticos.

| Fixture | Finalidade | Estado / revisão | Datas | Item | Porta |
| --- | --- | --- | --- | --- | --- |
| 209 | Edição SQL06 | rascunho / 0 | 2027-01-10 a 2027-01-31 | 309 | TESTE SQL06 EDITAR |
| 210 | Cancelamento SQL06 | publicado / 0 | 2027-02-01 a 2027-02-28 | 310 | TESTE SQL06 CANCELAR |
| 211 | Exclusão SQL06 | rascunho / 0 | 2027-03-01 a 2027-03-31 | 311 | TESTE SQL06 EXCLUIR |

Cada item pertence ao rodízio de mesmo sufixo 2xx e tem `auxiliar_id=NULL`; dados não representam pessoas reais. SELECT independente confirmou os três títulos, estados, datas, revisões e itens após transação. Quantidade esperada após preparo: **10 escalas, 10 itens**. Nenhuma RPC SQL06 foi invocada; instalação SQL06 segue intacta; não houve alteração na HML principal, main Neon, Supabase origem ou produção.

**Importante:** P01 (criação por RPC JWT) ainda necessita teste próprio, pois as três fixtures acima foram criadas por SQL de preparação, não pela RPC. P02/P05/P07 somente poderão ser considerados aprovados após execução **separada** com JWT Admin, conferência do SQLSTATE e reconciliação de cada fixture. Não repetir uma operação após timeout. A exclusão deve atingir exclusivamente 211 e 311; nenhuma outra fixture pode ser afetada. O bypass DML direto continua aberto.

## Negativas JWT N01–N04 — interface preparada

Adicionados à tela isolada `NeonRpcBranchHomologacao` quatro controles para JWT real Auxiliar/Coordenadora. Todos conferem previamente a sessão e recusam contas Admin. Cada teste invoca sua respectiva RPC SQL06 com parâmetros válidos, usando somente fixtures 209–211 para alterar/cancelar/excluir; criação negativa usa título fictício próprio. Resultado aprovado exige `SQLSTATE 42501` e mensagem `Somente administrador autenticado`. Qualquer resposta diferente, inclusive sucesso, interrompe os demais testes durante a sessão e obriga conferência independente do banco.

**Não executados ainda:** estas provas dependem de publicação do build e autenticação com JWT real. A presença dos botões no site não equivale à validação. Não registrar JWT/OTP nos relatórios. A interface segue disponível somente no host de HML, rota com opt-in `?rpc-branch-test=1`, e usa CLIENTE de Auth/Data API fixo na branch descartável. Após cada negativa, reconciliar título/status/revisão da fixture alvo e verificar ausência de escala com título N01.

**Importante:** os botões positivos SQL05 T01/T04 e o positivo legado 205 foram removidos; `#44851827647` confirmou build, testes e lint verdes após correção TS. A nova alteração N01–N04 precisa de CI próprio antes de qualquer teste de campo. Nenhuma mudança nos grants de tabelas foi aplicada.

## Evidência de campo N01 — Auxiliar, 21/11/2026

Capturas do usuário demonstram sessão JWT válida com perfil `auxiliar` e chamada real à RPC `criar_rodizio_rascunho_versionado` na branch descartável `br-holy-term-b6v6ofea`. A interface exibiu `cenario=N01`, `aprovado=true`, `SQLSTATE=42501` e erro de permissão `Somente administrador autenticado...`. Resultado: **N01 aprovado — recusa por perfil**.

Reconciliado por SELECT independente após a prova: **10 escalas, 10 itens**, **zero** escalas com título `TESTE SQL06 NEGATIVA JWT FICTICIO`; fixture **209** permanece `TESTE SQL06 EDICAO EXCLUSIVO`, `rascunho`, `travado=false`, `revisao=0`, datas 2027-01-10 a 2027-01-31. Nenhuma mutação indevida identificada.

**Próximo gate:** somente N02 com Auxiliar, depois SELECT independente da 209; N03 e N04 não executar ainda. Nenhuma alteração na HML principal, Neon main ou produção.

## Evidência de campo N02 — Auxiliar, 21/11/2026

Captura do usuário demonstra `cenario=N02`, perfil `auxiliar`, função `atualizar_cabecalho_rascunho_versionado`, `aprovado=true`, `sqlstate=42501` e recusa explícita de autorização administrativa pela RPC na branch descartável `br-holy-term-b6v6ofea`.

SELECT independente posterior confirma fixture 209 intacta: título `TESTE SQL06 EDICAO EXCLUSIVO`, datas `2027-01-10` a `2027-01-31`, `rascunho`, `travado=false`, revisão `0`, observação fictícia original e **um item**. Fixtures 210 (publicado, revisão 0, um item) e 211 (rascunho, revisão 0, um item) também permanecem preservadas.

**N02 aprovado, sem mutação indevida.** Próximo teste autorizado na sequência: somente N03 (negação de cancelamento da fixture 210), seguido de SELECT independente. Não executar N04 ou positivos Admin até reconciliar N03.

## Evidência de campo N03 — Auxiliar, 21/11/2026

Captura fornecida pelo usuário: `cenario=N03`, `perfil=auxiliar`, `funcao=cancelar_rodizio_versionado`, `aprovado=true`, `sqlstate=42501`, mensagem da RPC recusando autorização exclusiva de Administrador. **Resultado: N03 aprovado na interface.**

Reconciliado por SELECT independente: fixture 210 (UUID terminado em `210`) permanece `TESTE SQL06 CANCELAMENTO EXCLUSIVO`, `publicado`, `travado=false`, `revisao=0`, datas `2027-02-01` a `2027-02-28`, com **1 item**. Banco preservado em **10 escalas e 10 itens**. **N03 homologado — nenhuma alteração indevida.**

Próximo gate: N04 com JWT Auxiliar, **somente negativa de exclusão** da fixture nova 211; após resposta, SELECT independente deve comprovar permanência da 211 e item 311. Não executar positivos Admin nem repetir SQL05.

## Evidência de campo N04 — Auxiliar, 21/11/2026

Captura do usuário: JWT com `perfil=auxiliar` na branch `br-holy-term-b6v6ofea`, cenário `N04`, função `excluir_rodizio_rascunho_versionado`, `aprovado=true`, `sqlstate=42501` e recusa do banco por exigir Administrador.

SELECT independente após tentativa: fixture `00000000-0000-4000-8000-000000000211` preservada, título `TESTE SQL06 EXCLUSAO EXCLUSIVO`, estado `rascunho`, `travado=false`, `revisao=0`, período 2027-03-01 a 2027-03-31. Item `00000000-0000-4000-8000-000000000311` presente e vinculado à 211. Totais preservados: **10 escalas, 10 itens**.

**Gate negativas SQL06 Auxiliar N01–N04 encerrado com 4/4 testes aprovados na interface e SELECT independente confirmatório.** Não generalizar para Coordenadora ou usuário não autenticado; ambos ainda pendentes. Próximo gate: planejar positivos com JWT Administrador, estado inicial e controles de idempotência/concorrência; executar somente de forma granular e em fixture sintética, jamais em 202–208. Nenhuma alteração na produção, Neon main ou HML principal.

## Gate P02 preparado — JWT Administrador (21/11/2026)

Implementado na tela isolada `NeonRpcBranchHomologacao.tsx` botão **P02 — Editar cabeçalho da fixture 209 uma única vez (Admin)**. Antes de qualquer RPC, exige JWT Admin, fixture 209 com ID exato, título `TESTE SQL06 EDICAO EXCLUSIVO`, `rascunho`, `travado=false`, revisão 0, datas 2027-01-10 e 2027-01-31, e exatamente um item 309 em 2027-01-15. A RPC envia `p_revisao_esperada=0`, mantém datas e altera só título/observações; sucesso esperado: revisão 1, título `TESTE SQL06 EDICAO EXCLUSIVO P02 APROVADO`, status rascunho. A interface se bloqueia após qualquer tentativa, inclusive erro de transporte; a execução definitiva exige SELECT independente.

**NÃO executar P02 até confirmação de CI e deploy**. Nesta entrega, P01 (criação), P05 (cancelamento) e P07 (exclusão) estão visíveis porém deliberadamente **sem botões executáveis**, aguardando novos gates. As negativas N01–N04 por Auxiliar já foram homologadas e reconciliadas. Nenhuma RPC SQL06 positiva foi executada nesta rodada. A estratégia não resolve o bypass de DML direto nem elimina a necessidade de verificar idempotência para P01.

Recomenda-se um SELECT independente sobre as fixtures 202–211 antes/depois da primeira prova positiva e paralisar imediatamente se títulos, quantidades, revisão ou itens não conferirem.

## Gate P05 preparado — cancelamento com JWT Admin (21/11/2026)

P02 confirmado por SELECT independente: fixture `209` com título `TESTE SQL06 EDICAO EXCLUSIVO P02 APROVADO`, rascunho, não travada, revisão 1, item `309` preservado. O botão P02 foi removido da tela de homologação para impedir nova execução.

Nova versão da tela isolada disponibiliza **somente P05** como positivo: exige JWT `admin`; antes de invocar `cancelar_rodizio_versionado(uuid,bigint)`, exige fixture `210`, título `TESTE SQL06 CANCELAMENTO EXCLUSIVO`, estado `publicado`, `travado=false`, revisão `0`, datas `2027-02-01` a `2027-02-28` e item `310` em `2027-02-15`. Emite uma única RPC com `p_revisao_esperada=0` e bloqueia nova tentativa nesta sessão mesmo diante de erro de transporte. Valida o estado esperado `cancelado`, revisão `1`, item `310` e demais campos intactos; conclusão depende de SELECT independente. Após mudança de estado/revisão, um reload da tela também bloqueia a repetição pelo preflight.

P01 (criação não idempotente) e P07 (exclusão) permanecem sem botões. Nenhuma chamada positiva P05 foi executada na preparação. Exigir CI verde do commit correspondente, confirmar deploy HML por captura e realizar somente uma prova Admin; em resultado inesperado, parar e reconciliar, jamais tentar novamente automaticamente.

A criação de um controle de UI **não** equivale a teste de autorização nem fechamento de bypass de DML direto; esses gates permanecem pendentes.
