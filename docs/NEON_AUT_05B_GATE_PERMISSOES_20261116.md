# AUT-05A / AUT-05B — Evidências de campo e gate de segurança (16/11/2026)

## Escopo
Somente a branch GitHub `chore/neon-migration-prep-20261115` e a branch Neon de homologação `br-late-night-b6pydxvn`. PR #2 permanece draft. Não executar merge, migração de dados reais ou deploy em produção.

## AUT-05A — Leitura do perfil Auxiliar: APROVADA no escopo observado
Capturas fornecidas pelo responsável em 16/11/2026 (horário do aparelho: 05:51) indicam:
- OTP aceito; sessão autenticada e identificação posterior de `perfil: auxiliar`.
- Consulta simples: 2 escalas visíveis.
- Consulta detalhada após correção investigativa: `escalasConsultadas: 2`, status `publicado` e `travado`, `escalasPublicadasOuTravadas: 2`, `rascunhosVisiveis: 0`, `auxiliaresVisiveis: 1`, `propriaAuxiliarVisivel: true`, `restricoesVisiveis: 0`.
- A captura de `Sem vínculo` é de um estado observado na rodada de autenticação, não comprova sozinha que uma conta sem vínculo foi impedida de ler dados.

Limitações: consultas estão limitadas a 20 registros por tabela; 0 restrições visíveis não é prova de bloqueio porque não houve fixture de restrições. As capturas não validam UPDATE/INSERT/DELETE nem isolamentos de múltiplas contas.

## AUT-05B — Ainda pendente (executar somente com fixtures sintéticas)
| Caso | Procedimento | Critério de aprovação |
| --- | --- | --- |
| 01 Logout | Na tela, clicar Encerrar sessão e observar resultado da verificação de sessão posterior | Sem sessão autenticada; após isso Testar acesso às escalas não pode revelar dados protegidos |
| 02 Sem vínculo | Usar conta de teste separada, autenticada e deliberadamente sem registro em usuarios_auxiliares | Perfil Sem vínculo, nenhuma escala de negócio ou cadastro restrito visível |
| 03 Auxiliar — leitura alheia | Provisionar segundo cadastro fictício e restrição sintética associada a outra auxiliar | Somente próprio cadastro e dados autorizados; registros de terceiros não retornam |
| 04 Auxiliar — escrita negada | Via cliente autenticado de teste, tentar INSERT/UPDATE/DELETE em escalas e concessão de perfil admin sobre fixtures | Operações negadas por RLS/GRANT; verificar estado do banco inalterado |
| 05 Histórico travado | Criar fixture de rodízio travado com itens e tentar UPDATE/DELETE/movimentação | Triggers/policies impedem alteração; dados permanecem idênticos |
| 06 Coordenadora/Admin | Contas de teste distintas, com concessão feita somente por administração confiável | Acesso positivo e negativo conforme matriz institucional aprovada |
| 07 Sessão inválida | Repetir consulta sem JWT e após encerramento | Nenhum dado protegido retorna; registrar resposta HTTP efetiva sem expor tokens |

## Alteração de interface
O botão Encerrar sessão passa a chamar logout e verificar novamente a sessão. Se a consulta posterior não for conclusiva, apresenta aviso em vez de afirmar êxito. A validação final requer deploy do commit da branch de teste e execução pelo celular.

## Regras de evidência
Registrar data, ambiente, commit, conta sintética identificada por apelido, operação, status HTTP e resultado esperado/observado. Não registrar e-mail pessoal, código OTP, JWT, segredo, dados de outras pessoas ou valores de conexão.

## Gate de liberação
Não aprovar a migração nem a PR #2 antes de concluir AUT-05B, revisar políticas com testes de escrita e executar CI/build do branch de homologação. Não efetuar merge na master sem autorização expressa.

## Resultado de campo AUT-05B-01 — 16/11/2026, 07:49–07:50 (horário do aparelho)
**APROVADO: encerramento de sessão e bloqueio da consulta posterior**, conforme seis capturas fornecidas pelo responsável.
- Antes do encerramento, sessão do perfil `auxiliar` permitiu consulta de duas escalas (`publicado` e `travado`), sem rascunhos; apenas a própria auxiliar visível.
- Ao acionar **Encerrar sessão**, a interface apresentou `Logout confirmado: a verificação posterior não encontrou sessão autenticada. Teste agora o acesso às escalas.`
- Na tentativa de leitura posterior, a Data API retornou `AuthRequiredError: Authentication required. A valid token is needed to access the resource.` Não houve exibição das duas escalas.
- A mensagem comprova ausência de credencial válida nessa requisição. O código HTTP exato não foi capturado, e o teste **não comprova revogação de JWT previamente copiado nem encerramento em outros dispositivos**.
- A captura de `Sem vínculo` não comprova a negativa de consulta nessa condição; AUT-05B-02 segue **pendente**.

**AUT-05B-01 concluído; AUT-05B-02 a 07 pendentes**, inclusive teste multi-dispositivo, quando aplicável. Sem promoção para produção.
