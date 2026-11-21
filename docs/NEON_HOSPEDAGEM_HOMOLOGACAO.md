# Hospedagem isolada para homologação Neon Auth (sem produção)

## Objetivo
Servir **o mesmo código da PR #2**, compilado com `VITE_NEON_HOMOLOGACAO_ENABLED=true`, em uma URL HTTPS distinta da aplicação atual. Testar do celular login, sessão, logout e permissões RLS com dados sintéticos.

## Replit: utilidade e limites
- Replit pode hospedar uma **cópia isolada** do frontend, disponibilizando URL HTTPS e logs de execução, sem tocar no `master`.
- O projeto de homologação deve ser criado **importando a branch `chore/neon-migration-prep-20261115`** do GitHub, e não recriando o aplicativo com um prompt genérico. Precisamos confirmar que a integração de importação da branch está disponível na conta Replit.
- Replit **não** substitui Neon, não migra tabelas/dados, não autentica usuários por conta própria e não aprova o RLS; apenas serve a interface de testes.
- Não fornecer senha PostgreSQL, `DATABASE_URL`, chaves administrativas, tokens nem dados pessoais ao frontend ou ao repositório.
- A conexão do Replit no ChatGPT não autoriza automaticamente deploy ou acesso ao código do GitHub a partir do Replit.

## Configuração do build de homologação
Variáveis **somente públicas**, específicas da branch de testes Neon:
```
VITE_NEON_HOMOLOGACAO_ENABLED=true
VITE_NEON_AUTH_URL=https://ep-purple-water-b6agr3hn.neonauth.c-2.sa-east-1.aws.neon.tech/rodizio_portas/auth
VITE_NEON_DATA_API_URL=https://ep-purple-water-b6agr3hn.apirest.c-2.sa-east-1.aws.neon.tech/rodizio_portas/rest/v1
```
Se o build exigir as variáveis Supabase legadas para compilar, use valores fictícios em homologação; não exponha as credenciais existentes.

Executar `npm install` e `npm run build` após configurar as variáveis. O HTML estático gerado em `dist/index.html` pode ser servido por um host HTTPS com controle de acesso. A versão normal do site nunca deve receber `VITE_NEON_HOMOLOGACAO_ENABLED=true`.

## Configuração pós-publicação, após conhecer a URL REAL
1. Verificar que a URL HTTPS da hospedagem abre **somente a tela NeonAuthHomologacao** e não expõe as telas do sistema em produção.
2. Adicionar **essa URL exata** às `trusted_origins` do Neon Auth da branch `br-late-night-b6pydxvn` (projeto `blue-sky-02214231`, provedor Better Auth).
3. Se houver política CORS da Data API, permitir somente o domínio de homologação (não utilizar `*`).
4. Testar conta já provisionada, sem vínculo e com e-mail ainda não verificado; primeiro efetuar a verificação pelo mecanismo de auth e confirmar a sessão.
5. Validar login, credencial inválida, expiração, saída, recuperação e perfis sem conceder privilégio administrativo antes de testar usuário sem vínculo.
6. Despublicar/desabilitar a URL ao encerrar a homologação.

## Bloqueios atuais
- Nenhum host Replit existente foi encontrado para este projeto.
- A URL HTTPS de homologação ainda **não existe**; não inventar URL.
- Ainda não há fluxo comprovado de entrega de magic link ou e-mail de verificação; provedor Neon compartilhado não suporta `send_auth_test_email` de teste, o que não equivale à impossibilidade de e-mails reais de auth.
- A conta de teste foi criada na branch Neon; `emailVerified=false`, zero perfis vinculados.
- Sem hospedagem/URL conhecida, ainda não configurar trusted origins.

## Alternativas
Cloudflare Pages, Netlify ou serviço equivalente também podem hospedar a mesma build isolada, sem criar um novo aplicativo. Selecionar apenas **uma** hospedagem e manter a URL fora de produção.

**Não executar merge, mudança em master, deploy de produção ou reativação do Supabase.**
