# Gate de validação — RPC atômica de itens em rascunho (19/11/2026)

## Escopo e infraestrutura
- PR #2, **draft**, sem deploy de produção e sem merge.
- CI #65 concluído com sucesso em `8c5ad7490051d41d2817c2cb4b123555bed5cc2d`.
- SQL candidato: `migration/neon/03_atomic_draft_items_PROPOSAL.sql`; corrigido para usar `public.usuario_atual_id()`, sem `auth.uid()` direto na função `SECURITY INVOKER`.
- Banco principal de HML: `br-late-night-b6pydxvn` (não aplicar a proposta nele neste gate).
- **Branch descartável criada**: `br-long-base-b6cgdojr` (`hml-atomic-draft-rpc-validation-20261119`), derivada da HML, sem vinculação à Data API da tela já publicada.
- Baseline na branch descartável: 1 escala rascunho (`...202`, 1 item), 1 publicada (`...203`, 3 itens), 1 travada (`...204`, 0 itens).
- Verificado no clone: wrapper `public.usuario_atual_id()` existe; função `public.substituir_itens_rodizio_rascunho` **ainda não existe**.

## Gate de aplicação da proposta
**Não aplicar SQL nesta etapa por padrão.** A proposta SQL traz o aviso expresso `NAO APLICAR AUTOMATICAMENTE`, exige revisão e gate explícito. Antes da execução:
1. Confirmar revisão Codex do último HEAD e ausência de achados críticos/P1.
2. Verificar conta/limites do projeto Neon e preservar a HML original.
3. Receber autorização específica para aplicar a proposta **apenas em** `br-long-base-b6cgdojr`.
4. Verificar que o JWT da chamada de teste corresponde à nova branch (Data API/endpoint específico); o cliente da HML principal não testa RPC instalada somente na branch filha.
5. Reconfirmar baseline antes e depois de cada cenário, nunca usar fixture histórica real.

## Casos obrigatórios (a executar)
| ID | Operação | Resultado esperado |
|---|---|---|
| RPC-01 | JWT Admin: substituir 1 item de rascunho `...202` por 2 válidos | Retorno 2; exatamente 2 itens; rollback/restauração ao baseline após teste |
| RPC-02 | JWT Auxiliar ou Coordenadora: solicitar substituição do mesmo rascunho | Negativa SQLSTATE `42501`, dados intactos |
| RPC-03 | Sem JWT e papel sem permissão | Acesso negado e nenhuma escrita |
| RPC-04 | JWT Admin: tentar alterar escala publicada `...203` | Negativa, 3 itens intactos |
| RPC-05 | JWT Admin: tentar alterar escala travada `...204` | Negativa, status e itens intactos |
| RPC-06 | JWT Admin: item com data fora do intervalo | Erro `22023`, itens anteriores preservados |
| RPC-07 | JWT Admin: JSON inválido, item sem porta, UUID incorreto | Erro, itens anteriores preservados |
| RPC-08 | JWT Admin: lote com violação de FK / erro em inserção | Transação toda desfeita; nenhum item perdido |
| RPC-09 | Duas requisições simultâneas para mesmo rascunho | Serialização; não pode resultar em estado misturado |
| RPC-10 | 0 e 501 itens; array vazio e excesso de limite | Rejeitados, estado preservado |
| RPC-11 | Rodízio inexistente | Erro e nenhuma escrita |
| RPC-12 | Confirmar dono, invoker, privilégios, policies, triggers e GRANT EXECUTE após a aplicação | Sem ampliação de acesso a `auth`; RLS permanece ativo |

## Restrições do teste
- Executar somente com itens fictícios na **branch descartável**, nunca em `br-late-night-b6pydxvn` ou produção.
- Capturar SQLSTATE/erros, contagens, hashes/IDs de itens pré/pós e identidade do JWT usado.
- Usar transações explicitamente revertidas quando disponíveis; a RPC em chamada HTTP é atômica por execução, não uma transação entre chamadas.
- Não confundir `0 linhas afetadas por RLS` com execução comprovada de trigger.
- Restaurar baseline em testes positivos ou descartar toda a branch após conclusão; a criação da branch não autoriza excluí-la automaticamente.
- Não migrar serviços/rotas para esta RPC antes de obter resultados reais com JWT e reavaliar a política de edição de escalas publicadas.

## Resultado até aqui
**Preparação aprovada:** CI #65 e clone HML isolado criado com baseline verificado.
**Não executado:** DDL de criação da RPC e testes de escrita transacional. Portanto o fluxo atômico permanece **não homologado**.
