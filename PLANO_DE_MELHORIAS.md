# Plano de Implementação de Melhorias

Este plano foi desenhado para atuar nos pontos de melhoria identificados na auditoria do projeto e será executado no futuro (em um ambiente com Node e gerenciadores de pacote disponíveis).

## Fase 1: Implementação de Roteamento Robusto (React Router)
Atualmente a navegação é feita via estado simples no React. Vamos migrar para o `react-router-dom` para permitir URLs diretas, histórico de navegação e compartilhamento de links.

**Passos:**
1. Instalar a dependência: `npm install react-router-dom` (ou pnpm).
2. Refatorar `src/main.tsx` ou `src/App.tsx` para envolver a aplicação com o `<BrowserRouter>`.
3. Criar a estrutura de rotas mapeando os componentes atuais:
   - `/` -> `<EscalaView />`
   - `/login` -> `<LoginPage />`
   - `/rodizios` -> `<RodizioAdmin />`
   - `/auxiliares` -> `<AuxiliaresAdmin />`
   - `/area-auxiliar` -> `<AreaAuxiliarMobile />`
   - `/configuracoes` -> `<Configuracoes />`
4. Atualizar o componente `src/components/Layout.tsx`:
   - Trocar funções baseadas em estado por `<Link>` e `useNavigate()`.
   - Adicionar o `<Outlet />` para renderizar o conteúdo interno da rota.
5. Garantir que as rotas protegidas verifiquem a autenticação do `useAuth` e façam redirecionamento correto (Ex: usar `<Navigate to="/login" />` se o usuário não estiver autenticado).

## Fase 2: Configuração e Otimização do Build
A dependência `vite-plugin-singlefile` junta toda a aplicação em um arquivo HTML gigante. Isso é ótimo se for enviado por WhatsApp/PenDrive, mas ruim se o sistema for hospedado na web (Vercel, Netlify, Firebase, etc.).

**Passos:**
1. Decidir o ambiente de produção: O sistema rodará apenas num HTML local ou será hospedado na web?
2. **Se for para a Web:** Remover `vite-plugin-singlefile` do `vite.config.ts` e `package.json`.
3. Ajustar scripts de deploy se necessário (revisar `.github/workflows/build.yml`).
4. **Se precisar manter o HTML único para distribuição offline:** Criaremos um script duplo no `package.json` (ex: `npm run build:web` e `npm run build:single`) para ter os dois cenários separados.

## Fase 3: Adição de Testes Unitários (Vitest)
A lógica de negócio em `gerarRodizioEquilibrado.ts` é o coração do sistema. Erros de refatoração nela podem bagunçar todas as escalas futuras.

**Passos:**
1. Instalar o ecossistema de testes compatível com o Vite: `npm install -D vitest` (ou pnpm).
2. Habilitar a configuração do Vitest no arquivo `vite.config.ts` (ou criar `vitest.config.ts`).
3. Criar o arquivo `src/domain/gerarRodizioEquilibrado.test.ts`.
4. Escrever cenários de teste, como:
   - *Cenário 1:* Gerar um rodízio perfeitamente equilibrado sem nenhuma restrição cadastrada.
   - *Cenário 2:* Garantir que a auxiliar "Maria" não seja escalada no dia X onde ela possui uma restrição.
   - *Cenário 3:* Validar se as regras de limite (distribuição justa) estão funcionando.
5. Adicionar o script `"test": "vitest"` ao `package.json`.
