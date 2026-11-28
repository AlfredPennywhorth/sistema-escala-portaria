# Homologação Neon Auth/RLS — Evidências 15/11/2026

## Ambiente exclusivamente de testes
- Neon project: `rodizio-auxiliares-portas` (`blue-sky-02214231`)
- Branch de homologação: `homologacao-auth-rls-20261115` (`br-late-night-b6pydxvn`)
- Banco: `rodizio_portas`
- Branch principal Neon: `main` (`br-lively-lab-b69kz252`) **não contém registros de negócio**.
- Dataset sintético colocado somente na branch de teste: 1 auxiliar, 3 rodízios (`rascunho`, `publicado`, `travado`). Nenhuma informação pessoal ou usuário real inserido.

## Resultados verificados diretamente no banco
| Caso | Resultado | Evidência |
|---|---|---|
| RLS ativo em 5 tabelas | APROVADO | 5 valores `relrowsecurity = true` |
| Políticas existentes | APROVADO | 4 em cada uma das 5 tabelas (20) |
| Gatilhos cadastrados | APROVADO quanto à existência | `trg_bloquear_rodizio_travado`, `trg_bloquear_itens_travados` |
| Privilégio anônimo de SELECT | APROVADO (negado) | `has_table_privilege('anonymous',...,'SELECT') = false` |
| Papel `authenticated` sem JWT | APROVADO (sem privilégio) | `usuario_atual_id() = NULL`, `usuario_tem_perfil('admin') = false`, `usuario_tem_vinculo() = false` |
| Leitura de registros sintéticos sem JWT | APROVADO (negada pela RLS) | Proprietário vê 1 auxiliar + 3 rodízios; `authenticated` sem JWT vê 0 + 0 |
| Escalada de privilégio por INSERT em `usuarios_auxiliares` | APROVADO (negada) | `SQLSTATE 42501` por policy RLS |
| INSERT de auxiliar sem JWT | APROVADO (negado) | `SQLSTATE 42501` |
| INSERT de rodízio sem JWT | APROVADO (negado) | `SQLSTATE 42501` |
| Integridade do banco principal | APROVADO | 0 auxiliares, 0 rodízios, 0 vínculos |

## Limitações importantes dos resultados
- Não houve JWT real de nenhum dos perfis; **não é homologação funcional do login**.
- Não executadas tentativas de UPDATE/DELETE de rodízios travados nem fluxos positivos de escrita/leitura autenticada.
- Magic link, recuperação de senha e troca de senha seguem bloqueados na camada Neon até teste real.
- Neon Auth requer origem confiável (trusted origin). Atualmente não há domínio de homologação externo autorizado.
- O formulário de homologação adicionado ao projeto só aparece com `VITE_NEON_HOMOLOGACAO_ENABLED=true`. Não entra na aplicação normal sem essa variável.

## Utilização local da tela de homologação
Na branch de migração, definir em arquivo **não versionado** `.env.local`:
```
VITE_NEON_HOMOLOGACAO_ENABLED=true
VITE_NEON_AUTH_URL=<URL_PUBLICA_NEON_AUTH_DA_BRANCH_DE_TESTE>
VITE_NEON_DATA_API_URL=<URL_PUBLICA_DATA_API_DA_BRANCH_DE_TESTE>
```
Executar `npm install`, depois `npm run dev`. Usar **somente contas de teste**. As URLs devem ser as da branch de homologação, nunca da principal enquanto o teste não for aprovado.
Este procedimento não é um deploy. Para homologar no celular de outra rede, será necessário preparar hospedagem HTTPS isolada e cadastrar sua origem nas origens confiáveis do Neon Auth.

## Casos que faltam antes de permitir merge ou deploy
1. Provisionar contas **de teste**, em caixa postal controlada e autorizada, para admin/coordenadora/auxiliar/sem vínculo. Não enviar e-mails a terceiros sem consentimento.
2. Fazer login e teste negativo com senha incorreta; confirmar cookie, sessão, revogação e logout.
3. Verificar JWT autenticado nas requests da Data API; testar RLS com contas reais e dados sintéticos.
4. Comparar acessos de 4 perfis e registrar respostas 200/401/403/RLS.
5. Testar e homologar magic link, confirmação de e-mail, redefinição e atualização de senha.
6. Testar proteção dos históricos travados, incluindo atualização, exclusão, movimentação de item e concorrência, na branch de testes.
7. Integrar serviços Neon às telas apenas após os testes, corrigindo diferenças de PostgREST, formatos de relacionamento e autenticação.
8. Reativar Supabase somente para backup, inventário e importação reconciliada, depois homologar o corte.

**Não alterar a `master`, não executar merge/deploy e não usar dados reais no ambiente de testes.**
