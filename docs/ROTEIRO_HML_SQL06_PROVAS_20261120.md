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
