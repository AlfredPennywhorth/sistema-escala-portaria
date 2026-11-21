# Gate de substituição transacional de itens — 19/11/2026

## Estado
**PROPOSTA VERSIONADA; NÃO EXECUTADA NO NEON.** Arquivo: `migration/neon/03_atomic_draft_items_PROPOSAL.sql`. Não ligar às telas, não mudar RLS, não mudar Supabase ou produção, nem misturar com os quatro itens de homologação preservados.

## Problema corrigido na proposta
O legado `src/services/rodiziosService.ts` faz `DELETE` e `INSERT` em requisições separadas dentro de `salvarItensRodizio`. Isso pode eliminar os itens de uma escala se o segundo passo falhar. A RPC PostgreSQL proposta executa validação, bloqueio da escala, DELETE e INSERT no **mesmo contexto transacional**; qualquer exceção deve reverter tudo.

## Restrições intencionais
- Apenas usuário autenticado com perfil Admin.
- Apenas escala com `status='rascunho'` e `travado=false`. Não permite editar escala publicada; decisão de negócio sobre edições pós-publicação segue pendente.
- `SECURITY INVOKER`, sem credenciais administrativas, respeitando RLS, privilégios e gatilhos existentes.
- Até 500 itens por chamada, com data, porta, vínculo e intervalo validados (FK aplicada pelo banco).
- Proibido substituir por array vazio nessa versão. Caso de limpeza completa exige operação separada, aprovação e regras próprias.
- Nenhuma alteração do fluxo legado; migração funcional da UI depende de posterior implementação e autorização.

## Matriz de testes obrigatórios na HML antes de habilitar
| Cenário | Resultado esperado |
|---|---|
| Admin, rascunho fictício com itens válidos | Todos os itens substituídos, quantidade conferida |
| Admin, item sem data/porta, data fora do intervalo | Erro; itens anteriores idênticos |
| Admin, auxiliar_id inexistente | FK falha; itens anteriores idênticos |
| Admin, rascunho, array vazio, mais de 500 itens | Rejeição sem mutação |
| Admin, publicada ou travada | Rejeição; linhas anteriores intactas |
| Coordenadora/Auxiliar, qualquer escala | Negativa por 42501; nenhuma mutação |
| Anônimo/sem JWT | Negativa; nenhuma mutação |
| Duas chamadas concorrentes para o mesmo rascunho | Resultado atômico e seriado; confirmar invariantes |
| Erro/falha no último item do lote | Reversão integral |
| DELETE/INSERT diretamente pelo cliente fora da RPC | Verificar políticas e se ainda é possível contornar a atomicidade |

## Gate de segurança ainda aberto
As policies RLS atuais concedem ao Admin INSERT/UPDATE/DELETE diretos para itens de escalas **não travadas**, inclusive publicadas. Portanto, a RPC isolada não impede que outro cliente use essas escritas diretamente e viole a regra proposta de "rascunho apenas". Antes do rollout, decidir e implementar proteção de banco consistente (RLS/trigger/função, com verificação de compatibilidade com a UI). A validação de publicação/travamento e histórico imutável também permanece separada.

**Atenção:** testar a RPC inicialmente em branch Neon descartável, não aplicar direto à HML compartilhada. Rodar CI, review Codex e prova de rollback. A produção requer autorização explícita adicional.
