# Handoff — migração Supabase → Neon | 15/11/2026

## Escopo e garantias
- Repositório: `AlfredPennywhorth/sistema-escala-portaria`.
- Branch isolada: `chore/neon-migration-prep-20261115`; PR #2 permanece **draft**.
- **Não** houve merge em `master`, deploy, alteração no Supabase inativo ou importação de dados reais.
- Neon: projeto `rodizio-auxiliares-portas`, ID `blue-sky-02214231`, banco `rodizio_portas`, PostgreSQL 18, região `aws-sa-east-1`.
- Neon Auth (Better Auth) e Data API provisionados; 5 tabelas, 20 policies RLS, dois triggers de travamento.
- Cadastro público desativado, e-mail verificado requerido, magic link configurado; **fluxos de usuário ainda não homologados**.

## Implementação em branch (não ativa)
- `src/lib/neon.ts`: cliente singleton Neon integrado com SupabaseAuthAdapter.
- `src/services/neonPilotService.ts`: consultas piloto de sessão, vínculo e rodízios.
- `src/services/neon/{auxiliares,restricoes,rodizios,areaAuxiliar,auth}Service.ts`: portas separadas dos serviços existentes.
- Esses serviços **não foram conectados às telas**. `src/lib/supabase.ts` e `src/services/*Service.ts` originais continuam no caminho em uso.
- `registrarHistoricoRealizado` no módulo Neon falha de forma explícita, sem tentar apagar itens travados. É intencional até haver solução transacional aprovada e teste.
- `authService` Neon aceita login, logout e perfil, mas bloqueia cadastro, magic link, recuperação e troca de senha até homologação. O adaptador SupabaseAuthAdapter envia OTP para `signInWithOtp`, e isso NÃO equivale automaticamente a link clicável; revisar interface antes de ativar.
- Não introduzir `DATABASE_URL` no frontend. Somente URLs públicas HTTPS.
- API do Neon está sem `add_default_grants`; privilégios via grants explícitos e políticas.

## Testes executados
- Foi confirmada a existência de 20 policies nas 5 tabelas com RLS ligado.
- Papel `anonymous` não tem SELECT nos dados; papel `authenticated` sem JWT não recebe ID nem permissão de administrador.
- Verificações de SQL são estáticas; não provam autorização positiva com JWT.
- CI de migração via `.github/workflows/neon-pr-check.yml`, build, lint e typecheck.
- O CI verde anterior (#4) cobria apenas o piloto; novos módulos exigem CI novo. Verificar run do commit mais recente.

## Pendências antes de habilitar Neon no runtime
1. CI verde para todos os módulos, corrigindo TypeScript e lint.
2. Migração semântica e testes integrados do login (incluindo recuperação, verificação e link) e fluxos de tela.
3. Usuários fictícios de cada perfil, com JWTs reais em Neon Auth e testes RLS positivos/negativos (não criar contas reais arbitrariamente).
4. Validação de triggers de histórico e funcionamento da geração de escalas; sem dados reais até homologação.
5. Auditar configuração local persistida pelo Zustand e como migrá-la quando necessário.
6. Ativar temporariamente Supabase para backup consistente, inventário de schema real e mapeamento de contas.
7. Importar dados em Neon com reconciliação, homologar e obter autorização explícita para merge/deploy.

## Avisos técnicos
- A migração 001 do Supabase contém sintaxe problemática `ADD CONSTRAINT IF NOT EXISTS`.
- O banco real poderá ter esquema distinto do versionado; não assumir igualdade até auditar.
- O fornecedor Neon orienta que hashes de senha do Supabase não sejam migrados diretamente para Better Auth; prever recredenciamento.
- O algoritmo de rodízio deve continuar intacto.
