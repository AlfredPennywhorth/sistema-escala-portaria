# Preparação de migração Supabase → Neon (sem acesso ao banco de origem)
Data: 2026-11-15
Origem: master @ 22eecccf4f1fba63a3cb69898c0875ae2763f35b
Status: preparação; **nenhuma mudança em produção**.

## Inventário verificado no código
- React 19 / Vite 8 / TypeScript; `@supabase/supabase-js` 2.x.
- `src/lib/supabase.ts`: cliente no browser com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Consultas PostgREST diretas: `src/services/{auxiliares,restricoes,rodizios,areaAuxiliar,auth}Service.ts`.
- `src/hooks/useAuth.ts`: depende de `supabase.auth.onAuthStateChange`.
- Login e-mail/senha, OTP magic link, redefinição de senha; perfis `admin`, `auxiliar`, `coordenadora`.
- Tabelas declaradas: `auxiliares`, `restricoes_auxiliares`, `rodizios`, `rodizio_itens`, `usuarios_auxiliares`.
- Migração 001 adiciona `dia_semana`, `porta`, `ativa`, altera nulidade de `data` e índices.
- Há 3 helpers SQL, RLS nas 5 tabelas e gatilhos de imutabilidade de rodízios travados.
- `usuarios_auxiliares.user_id` referencia `auth.users(id)` do Supabase; `is_admin()`, `is_coordenadora()` e policies usam `auth.uid()`/`auth.role()`.
- `src/domain/gerarRodizioEquilibrado.ts` é independente do backend; preservar sem alterações.
- GitHub Actions `.github/workflows/build.yml` faz build na `master` e commita HTML; **não executar migração nessa branch**.

## Riscos / decisões obrigatórias
1. **Identidade**: não importar `auth.users` como se fosse tabela de negócio. Definir migração suportada para Neon Auth atual (Managed Better Auth) e uma tabela de mapeamento `supabase_user_id -> neon_user_id`. Não assumir UUID no novo provedor. Validar fluxo de login/senha/magic link/reset em homologação. Nunca colocar senhas ou hashes no Git.
2. **Autorização**: RLS padrão usa funções `auth.*` específicas do Supabase. Definir política correspondente às claims verificadas no Neon Data API; só liberar a aplicação quando testes negativos de acesso passarem. Não expor URL `postgresql://` ou `DATABASE_URL` em `VITE_*`, HTML, frontend ou arquivos versionados.
3. **Schema real**: pode divergir de `supabase/schema.sql`. A migração 001 contém `ADD CONSTRAINT IF NOT EXISTS`, que não é sintaxe portátil de PostgreSQL. Não executar `schema.sql` diretamente sobre um dump sem verificar objetos existentes.
4. **Histórico travado**: `registrarHistoricoRealizado()` tenta excluir itens de rodízio travado, possivelmente barrado pelos gatilhos. Conferir antes de alterar comportamento; preservar o histórico.
5. **Leituras e configurações**: `EscalaView` mistura dados do Supabase e Zustand/localStorage. Precisamos avaliar dados locais de cada instalação; não estão contidos no dump PostgreSQL.
6. **Proteção dos dados**: nomes, telefones, e-mails e escalas são dados pessoais. Backups devem ser criptografados, com acesso restrito. Não compartilhar strings de conexão nem dumps em issues, PRs ou chats.

## Preparação que independe da base ativa
- [x] Inventário do código e dependências.
- [x] Branch isolada criada.
- [x] Script SELECT-only em `migration/neon/01_auditoria_origem_readonly.sql`.
- [ ] Provisionar projeto/branch Neon de teste (requer conta Neon autorizada).
- [ ] Escolher implementação e política de migração de autenticação, elaborar esquema destino e plano de rollback.
- [ ] Implementar camada de dados/autenticação em branch isolada, com testes (sem produção).
- [ ] Validar testes de autorização positiva e negativa.
- [ ] Conferir schema real, migrações e dados da origem quando Supabase voltar a ficar disponível.

## Sequência quando a base de origem puder ser ativada
1. Ativar Supabase temporariamente. Se a ativação estiver indisponível, verificar exportação/backups recuperáveis antes de qualquer ação destrutiva.
2. Usar `01_auditoria_origem_readonly.sql` no SQL editor (apenas SELECT). Conferir esquema, FKs, policies, triggers, índices, contagens e integridade.
3. Gerar backup consistente de dados e schema com PostgreSQL `pg_dump`/ferramenta aprovada (incluir inventário de usuários/Auth separadamente, sem senhas em documentos). Guardar fora de Git.
4. Importar em Neon *isolado*, adequar `auth.users`/RLS e migrar identidades. Comparar contagens, referências, amostras, datas, status e hashes seguros onde aplicável.
5. Homologar as operações e restrições, inclusive escala publicada/travada, perfis, tentativas não autorizadas, impressão e histórico.
6. Fazer cutover somente com autorização explícita e rollback testado. Não desativar Supabase até validar produção no Neon.

## Gate de liberação
**Bloqueado** até: backup comprovado, migração de identidades e segurança homologadas, dados reconciliados, build/testes verdes e aprovação explícita do proprietário.
