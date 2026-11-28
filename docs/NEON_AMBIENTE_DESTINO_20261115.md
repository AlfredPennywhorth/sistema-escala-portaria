# Neon — estado do ambiente de destino (2026-11-15)
## Recursos provisionados (isolados)
- Neon project: `rodizio-auxiliares-portas`; ID `blue-sky-02214231`.
- Região: `aws-sa-east-1`; PostgreSQL 18.
- Database: `rodizio_portas`; branch: `main` (ID `br-lively-lab-b69kz252`).
- Neon Auth: Better Auth provisionado; schema `neon_auth`. URL/segredos não versionados.
- Tabelas vazias criadas em `public`: `auxiliares`, `restricoes_auxiliares`, `rodizios`, `rodizio_itens`, `usuarios_auxiliares`.
- `usuarios_auxiliares.user_id` referencia `neon_auth."user"(id)` (UUID) com UNIQUE, em vez de `auth.users(id)` do Supabase.
- `restricoes_auxiliares` inclui `dia_semana`, `porta`, `ativa` e `data` nullable, conforme migration 001.
- Índices auxiliares e relacionamentos básicos criados.
- RLS ligado nas 5 tabelas; **0 policies** deliberadamente: acesso do cliente bloqueado até implementar e testar claims e políticas de segurança.
- Os gatilhos de imutabilidade de rodízios travados e as policies de acesso ainda **não** foram migrados, e deverão ser implementados/testados antes de importar dados reais e abrir o acesso.
- Não há dados importados nem usuários migrados. Não foram alterados secrets do build, workflow ou `master`.

## Gates pendentes
1. Implementar RLS e função de identidade do Neon de acordo com o formato dos JWTs da Data API e testar cada perfil.
2. Migrar os gatilhos e confirmar proteção de rodízios travados, incluindo cenário de histórico realizado.
3. Implementar adapter de dados e autenticação no frontend sem colocar database password no navegador.
4. Homologar ambiente isolado com dados sintéticos.
5. Quando Supabase puder ser reativado: auditoria real, backup consistente, migração de usuários, tabelas, comparação, testes e corte supervisionado.
6. Só liberar merge/deploy com autorização expressa.
