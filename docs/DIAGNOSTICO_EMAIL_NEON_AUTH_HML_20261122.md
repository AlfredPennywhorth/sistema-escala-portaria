# Diagnóstico Neon Auth OTP por e-mail — homologação (22/11/2026)

**Situação:** pendente de comprovação de recebimento e confirmação real do OTP. Este runbook é **somente diagnóstico**. Não autoriza alterar provedor de e-mail, usuários, credenciais, configuração Auth, Neon main, origem Supabase, banco ou produção.

## Contrato implementado e limites

- Em `src/services/neon/authService.ts`, solicitar código chama `criarClienteNeon().auth.signInWithOtp({ email })`.
- A resposta sem erro indica **somente que a API aceitou o pedido**. Não demonstra geração, saída SMTP, entrega à caixa postal ou login válido.
- A confirmação real usa `auth.verifyOtp({ email, token, type: 'email' })`, seguida de validação de sessão e perfil em `usuarios_auxiliares` via JWT/RLS.
- O formulário em `src/components/NeonAuthHomologacao.tsx` já distingue pedido aceito de código confirmado. Não registrar OTP, JWT, URL com segredo ou e-mail pessoal em PR, logs ou chat.
- **O envio não foi comprovado.** Não declarar autenticação aprovada com base apenas em HTTP 200.

## Roteiro de isolamento (um pedido por vez)

1. Confirmar host de **homologação**, `VITE_NEON_HOMOLOGACAO_ENABLED=true`, projeto/branch/endpoints esperados e existência da conta de teste previamente provisionada; não executar pedidos na produção.
2. Em uma única tentativa autorizada, anotar localmente horário BRT aproximado, resultado apresentado pela UI (`aceito`, `erro`, `timeout`), e **se houve ou não recebimento físico** em entrada, spam e quarentena. Não registrar o endereço da conta no repositório.
3. Com acesso autorizado e **somente leitura**, verificar os logs do provedor de autenticação e o status da configuração de envio de e-mail no ambiente correto: solicitação recebida, eventual rate limit, política de domínio/conta, mensagem gerada, encaminhamento ao provedor SMTP e erro reportado. A disponibilidade e os nomes desses registros dependem da configuração do Neon Auth.
4. Se houver provedor de entrega separado, verificar nele, de forma autorizada e somente leitura, os estados de aceitação, rejeição, bounce ou supressão para aquela janela; DNS SPF/DKIM/DMARC e configuração do remetente devem ser conferidos **sem alterá-los**.
5. Se a mensagem chegar, validar o **código de uso único** na própria tela e confirmar sessão, perfil e permissões no destino Neon. Testar dois Admins distintos e uma negativa Auxiliar em janela controlada, com consentimento e sem capturar tokens.
6. Se a mensagem não chegar, **parar** e classificar a fase de falha abaixo antes de solicitar novos códigos. Não usar repetição cega: cada tentativa pode invalidar o código anterior ou acionar rate limiting.

## Classificação de falhas e evidência mínima sem PII

| Fase | Evidência permitida (sem contas/segredos) | Interpretação |
| --- | --- | --- |
| Falha imediata na UI/API | Código HTTP genérico, horário e categoria do erro | Solicitação não foi aceita/concluída |
| Aceite API sem evento no emissor | Registro de pedido aceito e ausência verificada de mensagem | Investigar pipeline Auth/provedor; não afirmar envio |
| Provedor aceitou, caixa não recebeu | Status anonimizado de entrega, rejeição ou supressão | Investigar entrega/antispam/configuração |
| Mensagem recebida, OTP rejeitado | Indicador `codigo_invalido` e horário, sem token | Investigar expiração, tipo e fluxo |
| OTP validado, perfil não Admin | Resultado `autenticado_sem_vinculo_admin` sem UUID | Investigar mapeamento Auth → `usuarios_auxiliares` |
| Dois Admins + Auxiliar comprovados | Registro de resultado por papel, sem identidade pessoal | Gate funcional pode ser submetido a revisão; não libera release sozinho |

## Critérios de saída

**Aprovado somente se** o código for efetivamente recebido, aceito no ambiente correto e o JWT permitir o conjunto de operações esperado para cada papel. A sessão deve permanecer válida após atualização/retorno à aba e perder acesso quando encerrada. Em caso de não entrega, timeout, falha de perfil ou lacuna de logs, marcar **PENDENTE** ou **BLOQUEADO**, não “aprovado”.

Nenhuma etapa exige executar SQL ou modificar banco. Configuração de SMTP/provedor, provisionamento de contas ou promoção de perfil dependem de autorização própria e revisão de segurança.
