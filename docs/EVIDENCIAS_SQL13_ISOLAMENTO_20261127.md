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
