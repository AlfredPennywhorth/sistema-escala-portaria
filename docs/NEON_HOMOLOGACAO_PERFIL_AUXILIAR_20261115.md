# Etapa AUT-05A — Homologação Auxiliar (15/11/2026)

## Preparação concluída
- Somente na branch Neon de testes `br-late-night-b6pydxvn`.
- Conta de homologação preexistente (`user_id = 97561149-24ed-421a-ae19-5ef2848ccfcd`) vinculada a `auxiliar_id = 00000000-0000-4000-8000-000000000201` (cadastro sintético), `perfil = 'auxiliar'`.
- Vínculo `usuarios_auxiliares.id = 4cc596e0-ff75-405e-a894-22583a2aeed1`.
- Nenhum privilégio `admin` ou `coordenadora` atribuído; dados do banco principal não alterados.
- Branch de teste mantém 3 rodízios fictícios: 1 `rascunho`, 1 `publicado`, 1 `travado`.

## Matriz esperada — leitura com JWT REAL
| Consulta | Esperado na branch de homologação |
| --- | --- |
| Perfil vinculado | `auxiliar` |
| Rodízios publicados ou travados | `2` |
| Rascunhos visíveis | `0` |
| Auxiliares visíveis | `1` (somente cadastro fictício vinculado) |
| Cadastro próprio visível | `true` |
| Restrições de auxiliares visíveis | `0` |

A tela de homologação incorpora o botão **Homologar permissões de Auxiliar**, que executa somente consultas `SELECT` pela Data API usando a sessão real do navegador. Uma resposta de zero linhas em tabela sem registros não prova por si que todos os acessos estão corretamente bloqueados. O cenário de restrições precisará incluir fixture sintética para teste forte e verificações negativas de gravação.

## Procedimento no celular — após deploy deste commit ou posterior
1. Abrir `https://rodizio-portaria-neon-hml.pages.dev/`.
2. Entrar novamente com código recebido pela conta de testes.
3. Selecionar **Verificar sessão e perfil**; resultado `perfil: auxiliar`.
4. Acionar **Homologar permissões de Auxiliar**; comparar campos do JSON com os valores esperados acima.
5. Não executar login com senha real, não compartilhar código OTP/JWT/captura contendo informações de autenticação.

## Próximas etapas
- Registrar captura e resultado do usuário para AUT-05A.
- Criar fixtures sintéticas de restrições na branch de teste e testar leitura/gravação negativa por auxiliar em transações revertidas.
- Validar por sessão autenticada os perfis `coordenadora` e `admin`, com aprovação específica de cada permissão. Registrar eventuais diferenças de RLS.
- Não executar merge/produção; a PR #2 permanece draft.
