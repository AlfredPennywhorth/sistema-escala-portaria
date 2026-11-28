# Evidências de isolamento SQL13 — 27/11/2026

**NO-GO para execução SQL13 e produção.** Registro factual das intervenções autorizadas; não substitui Gate A do runbook nem autoriza SQL12. 

## Alvos
- Projeto blue-sky-02214231, DB rodizio_portas.
- Branch original descartável br-holy-term-b6v6ofea; Data API continua ativa.
- Nova execução br-little-hill-b6q7979y, endpoint ep-sparkling-frog-b6k2wvw7, desabilitado ao final.
- Recuperação br-square-sunset-b61gcroy, sem endpoint, LSN 0/28E7B88.
- Ensaio de recuperação br-muddy-term-b66fxb8b, endpoint read_only ep-polished-cherry-b6stwnr0.
- Main, Supabase e produção fora de escopo.

## Evidências
- Criação sem compute da branch de execução: 20:51:42 UTC. Snapshot nativo recusado HTTP 400 (not allowed to snapshot non-root branch).
- Cópia de recuperação criada sem endpoint a partir da execução sem compute; ensaio posterior em descendente read-only confirmou transaction_read_only=on, pg_is_in_recovery=true.
- Recuperação: 10 escalas, 9 itens, 2 auxiliares, 0 restrições (dados de ensaio). Comparação posterior entre execução e recuperação: MD5 agregado de rodizios f97fbb54ecd28143cc6a41475a76d4ed, rodizio_itens aae68ef47c52dbeeb15334dfa0edf856, corpo RPC b06899977f63be59f8c993b05d134498, iguais nos dois ambientes. Não comprova rollback pós-commit nem demais tabelas.
- Credenciais de rodizio_portas_owner e authenticator rotacionadas na execução às 21:24:43 e 21:24:46 UTC; nenhuma credencial registrada.
- Endpoint desabilitado impede conexão administrativa e consulta Data API (503); habilitação controlada revelou Data API ativa herdada.
- Remoção autorizada da Data API somente da execução: primeira tentativa HTTP 412 com endpoint desabilitado; segunda tentativa com endpoint habilitado concluída; GET enabled=false confirmado, original enabled=true/active; endpoint novamente desabilitado.
- Auditoria posterior: authenticator/neon_auth sem DML direto na tabela rodizios; cloud_admin (superuser), neon_service e owner possuem DML direto/BYPASSRLS; todos cinco têm CONNECT. Zero outros clientes na amostra da execução; não constitui prova contínua de exclusividade.
- PR #2 HEAD b194ab34bf471e3aa491917e517e1ddb4d0b073d: CI 46061719262 success, Codex sem achados maiores nesse SHA. SQL13 blob 29926bb24c938ce85cdba636a0c962ae1f02266a; baseline b06899977f63be59f8c993b05d134498; pós esperado f2100180626d8fd8881aebb99ca57d0d.

## Bloqueios e decisão requerida
1. Runbook original exige snapshot nativo, alvo antigo, suspensão de todos ingressos contínua e JWT real antes de SQL13. Nova branch autorizada, mas substituição do snapshot por branch e exceção de papéis gerenciados precisam de revisão explícita do procedimento; não declarar equivalência integral.
2. Data API removida impede JWT real nessa branch. Separar ensaio transacional SQL13 em janela administrativa de homologação posterior JWT, com ingresso exclusivo de clientes de teste, sem afrouxar gates de produção. Revisar antes de executar; não habilitar API automaticamente.
3. Papéis internos gerenciados não devem ser alterados por tentativa e erro. Obter confirmação Neon sobre isolamento de usuários e atividades gerenciadas, ou aceitar formalmente risco residual apenas em ensaio descartável e definir controles compensatórios (credenciais renovadas, API ausente, lock exclusivo, comparação pré/pós, rejeição de clientes inesperados, bloqueio no finally).
4. SQL12, backup restaurável Supabase, segundo Admin, migração/reconciliação real, E2E e aprovação de produção permanecem pendentes.

Nenhuma SQL13/SQL12 executada. Não usar como GO de produção.


## Atualização posterior — execução autorizada da SQL13
O responsável autorizou expressamente o procedimento alternativo exclusivamente em br-little-hill-b6q7979y, com risco residual dos papéis gerenciados e controles compensatórios, sem alterar esses papéis. O registro anterior NO-GO para instalação foi superado somente neste escopo; produção e homologação JWT permanecem NO-GO.

- Artefato imutável: blob 29926bb24c938ce85cdba636a0c962ae1f02266a do commit b194ab34bf471e3aa491917e517e1ddb4d0b073d.
- Metadados confirmados: projeto blue-sky-02214231, branch br-little-hill-b6q7979y, compute ep-sparkling-frog-b6k2wvw7, banco rodizio_portas, executor rodizio_portas_owner, Data API enabled=false. Recuperação br-square-sunset-b61gcroy pronta e sem endpoint.
- Execução: os seis comandos SQL originais entre BEGIN/COMMIT foram enviados na mesma transação gerenciada pelo conector, sem dividir corpos PL/pgSQL; duas guardas adicionais após o lock e antes do commit verificaram ausência de outros clientes e hashes das duas tabelas. O conector retornou sucesso em oito comandos.
- Preflight e postflight do arquivo aprovado passaram. Corpo RPC antes b06899977f63be59f8c993b05d134498; depois f2100180626d8fd8881aebb99ca57d0d, exatamente o esperado. Hashes das escalas f97fbb54ecd28143cc6a41475a76d4ed e itens aae68ef47c52dbeeb15334dfa0edf856 permaneceram idênticos. Zero outros clientes nas consultas pré/pós; não afirmar exclusividade absoluta dos papéis gerenciados.
- Endpoint bloqueado novamente após execução e auditoria posterior. Nenhuma mudança nos papéis internos, na produção, na origem Supabase ou na branch de recuperação.
- Catálogo posterior confirmou auth.uid() do pg_session_jwt, wrappers de identidade/perfil SECURITY DEFINER com search_path vazio; três perfis (um de cada). Isso não prova JWT real.
- **SQL13 instalada; homologação funcional ainda pendente.** Necessários JWT real em acesso de teste controlado, segundo Admin independente, testes de revisão/estado, FK, concorrência, histórico e rollback pós-commit. SQL12 não executada e continua exigindo autorização específica. Não marcar gates de produção como aprovados.

## Provisionamento Auth/Data API e primeira negativa SQL13
- Autorização explícita para Better Auth e Data API somente br-little-hill-b6q7979y. Ambos provisionados; Data API active com neon_auth, schema public, OpenAPI desativado, CORS https://rodizio-portaria-neon-hml.pages.dev; add_default_grants=false, skip_auth_schema=true. Auth aceita a origem canônica e localhost (configuração herdada; não constitui isolamento de rede). Cadastro público desativado. Não publicar credenciais.
- Hash SQL13 f2100180626d8fd8881aebb99ca57d0d e hashes de escalas/itens anteriores preservados após provisionamento. Três vínculos existentes correspondem a três identidades no catálogo neon_auth.user (um admin, uma coordenadora, uma auxiliar), zero sessões ativas no instante da consulta.
- Teste de banco: SET LOCAL ROLE authenticated, usuario_atual_id() IS NULL, chamada RPC SQL13 com UUID fictício e payload sintaticamente válido; capturado SQLSTATE 42501. Prova negativa sem JWT em conexão SQL, não prova HTTP nem JWT real; sem mutação.
- Endpoint novamente desabilitado. Não foi alterada a configuração da aplicação canônica nem promovida conta. O build atual não aponta para a nova branch; requer origem/cliente de teste isolado, allowlist exata e autenticação real. Segundo Admin ainda pendente. CORS não impede clientes não-browser. SQL12 e produção NO-GO.

## Homologação funcional com JWT real — 27/11/2026
Cliente local no commit 587091ef9be862ce0594b4ed7c0c05ea92d688f3, CI 46081479489 aprovado e Codex sem problemas relevantes. OTP entregue; primeira confirmação de identidade inconclusiva, segunda confirmou Admin via comparação da identidade da sessão com RPC PostgreSQL e vínculo. Operador enviou seis resultados approved:true:
- Admin stale P0001 em publicado não travado com revisão divergente.
- Admin locked P0002 por RLS, não prova precedência OCC em histórico.
- Admin published 42501 por estado.
- Admin invalid-fk 23503, snapshot antes/depois idêntico.
- Admin valid sem erro, fixture 205 revisão 0 -> 1, um item correto.
- Auxiliar negative 42501 por perfil, JWT real confirmado.
Reconciliação independente após negativa: fixture 205 rev 1, exatamente um item esperado (Entrada, 2026-12-15, auxiliar_id null, observacoes TESTE SQL13); outras escalas hash 54e1b185d387749751e26c7269adb261 e outros itens 24e3ea9274852d359e9f8ca0dcb70593 iguais ao baseline da branch de recuperação. A negativa ocorreu após positivo (rev esperada 0), mas mensagem de autorização exigida pelo cliente confirma causa por perfil. Não repetir fixtures consumidas. Um Admin ativo no cadastro; concorrência de duas identidades ainda não realizada. Não executar SQL12 até gate e autorização aplicáveis. Não houve mudança em outras branches ou produção.

## Preparação de concorrência
Autorização explícita do operador: promoção temporária da Coordenadora exclusivamente em br-little-hill-b6q7979y. Transação com lock, validação de pré/pós-condições: três identidades distintas, perfis 1 admin/1 coordenadora/1 auxiliar -> 2 admin/1 auxiliar. Vínculo específico registrado para restauração no banco após teste (não publicar identificadores pessoais). Fixture 202 confirmada rascunho, destravada, revisão 0, um item. Preparar ambos os clientes antes do primeiro disparo; registrar um sucesso e um P0001, reconciliar estado e restaurar perfil. Disparos manuais não garantem sobreposição temporal; não afirmar concorrência física sem evidência.
