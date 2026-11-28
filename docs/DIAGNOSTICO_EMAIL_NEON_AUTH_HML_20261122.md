# Diagnóstico Neon Auth OTP por e-mail — homologação (22/11/2026)

**Situação em 23/11/2026:** recebimento de pelo menos uma mensagem OTP confirmado pelo usuário, mas confirmação de login falhou por código expirado. Entrega tempestiva e autenticação continuam pendentes. Este runbook é **somente diagnóstico**. Não autoriza alterar provedor de e-mail, usuários, credenciais, configuração Auth, Neon main, origem Supabase, banco ou produção.

## Contrato implementado e limites

- Em `src/services/neon/authService.ts`, solicitar código chama `criarClienteNeon().auth.signInWithOtp({ email })`.
- A resposta sem erro indica **somente que a API aceitou o pedido**. Não demonstra geração, saída SMTP, entrega à caixa postal ou login válido.
- A confirmação real usa `auth.verifyOtp({ email, token, type: 'email' })`, seguida de validação de sessão e perfil em `usuarios_auxiliares` via JWT/RLS.
- O formulário em `src/components/NeonAuthHomologacao.tsx` já distingue pedido aceito de código confirmado. Não registrar OTP, JWT, URL com segredo ou e-mail pessoal em PR, logs ou chat.
- **Houve recebimento de uma mensagem OTP** em 23/11, porém a entrega utilizável/confirmada não foi comprovada. Não declarar autenticação aprovada com base apenas em HTTP 200 ou na presença da mensagem.

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


## Evidências de campo de 23/11/2026 e leitura de configuração (sem PII)

- Usuário observou na interface da HML o aviso de pedido aceito pelo provedor; Gmail mostrou e-mails anteriores em 16/11 e 18/11.
- Em 23/11, mensagem com horário registrado **06h23 BRT** só apareceu ao usuário por volta de **06h35 BRT** após pesquisa; o OTP foi rejeitado como **expirado**. Intervalo observado de aproximadamente 12 minutos **não permite afirmar** se houve atraso no provedor, na entrega SMTP, na sincronização do Gmail ou apenas na apresentação do e-mail.
- Consulta administrativa SOMENTE LEITURA de Neon Auth no projeto `blue-sky-02214231`, branches `br-late-night-b6pydxvn` e `br-holy-term-b6v6ofea`: autenticação e-mail/senha habilitada, verificação por OTP, `allow_sign_up=false`, provedor compartilhado `auth@mail.myneon.app`, origem da HML autorizada.
- Logs `neon_auth` indisponíveis, retorno `telemetry_not_enabled`; nenhuma mudança para ativar exportação foi feita.
- `magic_link.expires_in=15` refere-se ao plugin de **magic link**, e `phone_number.otp_expires_in=300` refere-se a OTP **telefônico desativado**. Nenhum dos dois comprova a validade do OTP de e-mail. A API de configuração consultada **não informou** o prazo de validade exato do OTP de e-mail.
- Documentação oficial de Neon Managed Better Auth, atualizada em 05/11: https://neon.com/docs/auth/guides/plugins/email-otp ; separa envio de código e confirmação do login, com métodos nativos do SDK. O aplicativo HML usa `SupabaseAuthAdapter` e chamadas `signInWithOtp`/`verifyOtp`; compatibilidade do adaptador com o fluxo nativo deve ser confirmada por testes, sem assumir equivalência do tipo OTP.
- Neon recomenda provedor SMTP dedicado para produção: https://neon.com/docs/auth/production-checklist ; **não** alterar provedor por conta deste achado sem autorização de mudança.

**Próxima coleta controlada:** obter, se possível, carimbos `Date`/cadeia `Received` do cabeçalho da mensagem (sem endereço pessoal, OTP ou identificadores sensíveis) para separar criação e trânsito. Fazer novo teste único somente depois de avaliar limites/rate limit e preparar recepção imediata. Falha na verificação não deve ser mascarada elevando o tempo de expiração.

## Critérios de saída

**Aprovado somente se** o código for efetivamente recebido, aceito no ambiente correto e o JWT permitir o conjunto de operações esperado para cada papel. A sessão deve permanecer válida após atualização/retorno à aba e perder acesso quando encerrada. Em caso de não entrega, timeout, falha de perfil ou lacuna de logs, marcar **PENDENTE** ou **BLOQUEADO**, não “aprovado”.

Nenhuma etapa exige executar SQL ou modificar banco. Configuração de SMTP/provedor, provisionamento de contas ou promoção de perfil dependem de autorização própria e revisão de segurança.
