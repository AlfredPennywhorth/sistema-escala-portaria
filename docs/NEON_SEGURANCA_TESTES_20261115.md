# Segurança Neon — implementação e gates de homologação (2026-11-15)

## Aplicado ao projeto `rodizio-auxiliares-portas`
- Neon Data API provisionada na database `rodizio_portas`, validando JWTs Neon Auth. Não foi habilitado `add_default_grants`.
- Neon Auth (Better Auth) habilitado; cadastro público desativado; verificação de e-mail obrigatória; revogação das sessões em redefinição de senha; magic link habilitado sem cadastro.
- SQL versionado em `migration/neon/02_security_and_integrity.sql` e correção em `03_auth_identity_wrapper.sql`.
- 20 policies RLS, 4 por tabela, para `authenticated`; zero políticas `anonymous`. GRANTs de tabela concedidos apenas a `authenticated`, não a `anonymous`.
- Funções `usuario_tem_perfil`, `usuario_tem_vinculo` e `usuario_atual_id` usam `SECURITY DEFINER` com `search_path=''` para acesso seguro ao ID verificado no contexto Neon. Não podem aceitar o ID do usuário como argumento fornecido pelo cliente.
- 2 triggers protegem update/delete de cabeçalhos travados e insert/update/delete de itens em rodízio travado.

## Resultados de testes executados
1. Inventário do banco: todas as 5 tabelas com 4 policies cada; **aprovado**.
2. Ambos os triggers existem; **aprovado** (existência apenas).
3. `has_table_privilege('anonymous', 'public.auxiliares', 'SELECT') = false`; **aprovado**.
4. `SET LOCAL ROLE authenticated` em uma transação, sem JWT: `usuario_atual_id()=NULL`, `usuario_tem_perfil('admin')=false`, `usuario_tem_vinculo()=false`, e nenhuma linha visível nas tabelas vazias; **aprovado**.
5. Tentativa de referência direta a `auth.uid()` como papel `authenticated` foi negada (`permission denied for schema auth`). Implementado wrapper `public.usuario_atual_id()` para policies com invocação direta; teste sem JWT **aprovado**.
6. **Não executados**: JWTs válidos com contas reais ou contas sintéticas, operações de edição e bloqueio via triggers, performance, REST real e app React.

## Pontos de atenção antes de importar dados
- O banco de origem está inativo; nenhum dado foi migrado e o schema real ainda não foi reconciliado.
- Na importação, inserir cabeçalhos temporariamente não travados, depois itens e por fim marcar como travados, sob roteiro controlado; os triggers impedem inserir itens em um cabeçalho já travado. Não retirar imutabilidade em produção para facilitar importação.
- O método `registrarHistoricoRealizado` do app antigo tenta apagar itens de rodízios travados. Esse fluxo deve ser corrigido com regra de negócio aprovada antes do cutover.
- `usuarios_auxiliares.user_id` referencia `neon_auth."user".id`, exigindo criar/reconciliar usuários Neon Auth antes de popular vínculos.
- A conta inicial de administrador precisa ser provisionada por canal administrativo confiável, pois RLS bloqueia autoconcessão de perfil.
- A API deve receber JWT do Neon Auth, nunca senha PostgreSQL. Não publicar `DATABASE_URL`, segredos, dumps ou tokens no repositório.
- Apenas o wrapper de identidade foi testado por chamada ao banco; os demais acessos precisam de testes de integração com sessões reais.
- `GET` com perfil auxiliar deve retornar somente escalas publicadas e travadas; admin vê rascunhos; coordenadora pode manter restrições; auxiliar não edita dados de outra pessoa.
- Testar tentativas de trocar `user_id`, criar perfil `admin`, manipular cabeçalhos travados e mover itens entre escalas — todas devem ser rejeitadas.

## Ordem de implantação
1. Concluir testes de segurança com usuários de teste e JWTs válidos.
2. Revisar SDK oficial Neon JS e implementar adaptador na branch GitHub de migração.
3. Executar testes de build, lint e smoke em ambiente isolado.
4. Somente então reativar a origem, auditar, fazer backup e migrar dados.
5. Não fazer merge na `master` e não fazer deploy antes de homologação/autorização.

Status: **segurança estrutural implantada; homologação funcional pendente**.
