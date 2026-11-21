# Auditoria RLS Neon — 17/11/2026

## Escopo
Banco Neon **somente homologação**: projeto `blue-sky-02214231`, branch `br-late-night-b6pydxvn`.
Testes de escrita executados exclusivamente em clone temporário `br-nameless-dawn-b6jndtvb`, criado a partir da branch HML. Nenhuma operação de escrita no banco principal, Cloudflare Pages de produção ou `master`.

## Evidências de homologação com JWT real (capturas do usuário, 16/11)
- Conta verificada e vinculada a `auxiliar`.
- Leitura RLS: 2 escalas (`publicado` e `travado`), 0 rascunhos, 1 auxiliar própria, 0 restrições.
- Logout confirmado; acesso sem token recusado (`AuthRequiredError`).
- Reutilização do OTP recusada (`Invalid OTP`).

## Auditoria SQL (17/11)
- 5 tabelas com RLS habilitado, 20 policies para `authenticated`.
- `usuario_tem_perfil`, `usuario_tem_vinculo` e `usuario_atual_id` usam `auth.uid()` e SECURITY DEFINER.
- `rodizios`: SELECT de Auxiliar/Coordenadora com vínculo e status publicado/travado; INSERT/UPDATE/DELETE reservados a admin.
- `restricoes_auxiliares`: operações reservadas a admin/coordenadora.
- `usuarios_auxiliares`: usuário lê vínculo próprio; mutações reservadas a admin.
- Gatilho de rodízio travado bloqueou UPDATE de escala travada (erro esperado).
- Gatilho de itens travados bloqueou INSERT em escala travada (erro esperado).
- UPDATE de escala publicada **não travada** foi permitido no clone (UPDATE idempotente, sem alterar valores). Isso é compatível com policy atual, mas exige validação da regra de negócio: publicação deve ou não impedir edições? Não modificar policy sem decisão.

## Limitações dos testes
Não se deve atribuir testes positivos por perfil somente por trocar `request.jwt.claim.sub`: o mecanismo Neon usa JWT validado, e essa simulação não produziu identidade (`usuario_atual_id() = NULL`). Assim, **não** foram homologadas mutações efetivas com JWT de Coordenadora/Admin, nem negações diretas de escrita por Auxiliar com JWT. Testes de UI/leitura não substituem autorização de escrita.

## Próximos testes obrigatórios
1. Conta Auxiliar com JWT real: INSERT/UPDATE/DELETE em rodízios, itens, auxiliares e vínculos devem ser negados.
2. Conta Coordenadora: acesso permitido às restrições; alterações em rodízios/usuários devem ser negadas.
3. Conta Administrador: confirmar operações autorizadas e negativa de edição em históricos travados.
4. Revisar edição de escala publicada não travada; se proibida, preparar migração de política e testes de regressão.

## Restrições
PR #2 deve permanecer draft, sem merge em `master`. Não copiar dados fictícios para produção. Nunca registrar tokens OTP/JWT em tickets, logs ou prints.
