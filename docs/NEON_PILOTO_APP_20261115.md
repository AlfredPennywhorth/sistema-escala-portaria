# Neon — piloto da aplicação (2026-11-15)

## Mudanças isoladas na PR #2
- Dependência de desenvolvimento de migração: `@neondatabase/neon-js@0.9.0-beta` (fixada, SDK ainda beta).
- Cliente `src/lib/neon.ts` cria conexão para Neon Auth + Neon Data API somente quando chamado.
- Serviço de homologação `src/services/neonPilotService.ts` valida sessão, vínculo `usuarios_auxiliares` e listagem limitada de rodízios sob RLS.
- URLs públicas de teste em `.env.neon.example`; nenhuma credencial de banco adicionada.
- `.github/workflows/neon-pr-check.yml`: build/lint em PR, Node 22, URLs fictícias.
- `src/store/useStore.ts`: removida assinatura de `updateCargaAcumulada` inexistente e sem referências, que impedia compilação no primeiro CI.
- Cliente e serviços Supabase em `src/lib/supabase.ts` e `src/services/*` **permanecem inalterados**.
- A aplicação **não usa** o cliente Neon por padrão; sem troca de runtime.

## Por que ainda não ativar o Neon
- O SDK oferece `SupabaseAuthAdapter()` e `from().select()/insert()/update()`, mas os métodos de autenticação não são totalmente equivalentes. Em particular, atualização de senha via `updateUser({password})` não está suportada pelo adaptador; deve-se integrar o fluxo Better Auth adequado.
- O cadastro público do Neon Auth está desligado. É preciso fluxo administrativo para provisionar usuários e reconciliar IDs.
- Magic link, recuperação de senha e sessão precisam de testes reais; não basta compilar.
- RLS ainda necessita testes positivos e negativos com identidades de cada perfil e históricos travados.
- A origem Supabase está inativa; não há exportação de dados nem mapeamento de usuários.

## Gates de promoção
1. CI (build e lint) verde na PR.
2. Testes de login, magic link, troca e recuperação de senha.
3. Testes RLS com usuários de teste (admin/coordenadora/auxiliar/sem vínculo), incluindo escritas negadas.
4. Implementar adaptadores de todos os serviços e telas sem regressões.
5. Origem reativada para backup, importação e reconciliação.
6. Homologação final e autorização explícita antes de qualquer merge ou deploy.

**Não fazer merge em master e não configurar URL Neon na publicação atual.**
