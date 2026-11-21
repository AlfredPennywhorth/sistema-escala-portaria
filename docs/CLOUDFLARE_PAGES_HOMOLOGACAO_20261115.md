# Cloudflare Pages — homologação do Neon (não produção)

Esta é a **substituição do ambiente Replit**. O código-fonte continua no GitHub; não há banco nem arquivos da aplicação para migrar do Replit. O backend permanece no Neon em **branch exclusivamente de testes**.

## Identificação
- Novo projeto Pages (sugestão): `rodizio-portaria-homologacao`.
- Repositório GitHub público: `AlfredPennywhorth/sistema-escala-portaria`.
- Branch de **produção do novo projeto Pages apenas**: `chore/neon-migration-prep-20261115`. **Não selecionar `master`.**
- Framework preset: React (Vite), ou None se os campos forem preenchidos manualmente.
- Root directory: `/` (raiz do repositório).
- Build command: `npm run build:cloudflare-homologacao`.
- Build output directory: `dist`.
- Node.js: definir variável `NODE_VERSION=22` (ou versão compatível suportada na conta).
- Não inserir variáveis do Supabase, tokens administrativos, DATABASE_URL nem chaves secretas. O comando de build já fornece somente URLs públicas do Neon da branch de testes e placeholders Supabase.
- Não vincular domínio de produção existente nem sobrescrever outro projeto Cloudflare.

## Controles de segurança embutidos
O script `scripts/build-cloudflare-homologacao.mjs`:
1. Aceita execução somente sob `CF_PAGES=1`.
2. Verifica que `CF_PAGES_BRANCH` é a branch de migração; falha se for `master` ou qualquer outra.
3. Força `VITE_NEON_HOMOLOGACAO_ENABLED=true`, restringindo a interface à tela de homologação.
4. Aponta unicamente ao Neon Auth/Data API da branch `br-late-night-b6pydxvn`.
5. Substitui URLs/chaves Supabase por **valores fictícios**, impedindo utilização das credenciais da origem.
6. Sem dados reais; não migra nem altera o banco.

## Ponto de intervenção da conta Cloudflare
Ainda não existe integração Cloudflare conectada a este chat para criar o Pages automaticamente. A operação não pode ser concluída por ferramentas GitHub/Neon. Acesse o painel Cloudflare, escolha Workers & Pages → Create application → Pages → Connect to Git → selecione o repositório indicado → configure os campos acima → Save and Deploy.

### Após o primeiro deploy, antes de testar login
1. Copiar a **URL HTTPS real** do novo Pages, por exemplo um domínio `pages.dev` retornado pelo painel (não presumir URL a partir do nome).
2. Adicionar **essa URL real** como trusted origin no Neon Auth da **branch de teste** `br-late-night-b6pydxvn` (Better Auth), não na principal.
3. Confirmar que a página mostra o título `Homologação Neon Auth`, não as telas do rodízio original.
4. Somente então testar a conta de homologação já provisionada, ainda com `emailVerified=false` e sem perfil. Verificar mecanismo de confirmação e acesso sem vínculo antes de atribuir papéis.
5. Não publicar informações sensíveis em links, logs ou capturas.

## Critérios de aprovação
- CI aprova TypeScript, build e lint com configuração isolada.
- Deploy HTTPS com commit da branch correta e interface de homologação.
- Trusted origin configurada exclusivamente no Auth de testes.
- Autenticação de verdade com e-mail verificado; testes negativos/positivos RLS por perfil, histórico travado e logout.
- Somente com autorização explícita avaliar corte da aplicação final.

**A PR #2 permanece draft. Nunca mergear ou publicar master sem autorização.**
