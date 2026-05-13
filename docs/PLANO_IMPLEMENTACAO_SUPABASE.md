# Plano de Implementação Supabase

Data de criação: 2026-05-09 01:08:03 UTC
Etapa: 1 — Diagnóstico inicial

## Objetivo

Planejar a evolução incremental do projeto `sistema-escala-portaria` para persistência com Supabase, autenticação, acesso mobile para auxiliares, travamento de rodízios e algoritmo de equilíbrio baseado em histórico, preservando a estrutura atual em React + TypeScript + Vite.

## Princípios de execução

- Não reescrever o projeto do zero.
- Não alterar regras de negócio durante a etapa de diagnóstico.
- Implementar em fases pequenas e verificáveis.
- Concentrar integrações externas em camadas isoladas.
- Documentar cada etapa em `docs/LOG_EXECUCAO_AGENT.md`.
- Executar build e validações antes e depois de mudanças funcionais.
- Nunca expor `service_role` no frontend.

## Fase 1 — Integração Supabase

**Objetivo:** adicionar o cliente Supabase ao frontend sem acoplar chamadas aos componentes.

**Ações previstas:**

1. Instalar `@supabase/supabase-js`.
2. Criar `.env.example` com:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Criar `src/lib/supabase.ts` para inicialização do cliente.
4. Validar que o frontend usa somente chave publicável/anônima.
5. Manter o fluxo atual em Zustand/localStorage até a camada de serviços estar pronta.

**Critérios de aceite:**

- Build passa.
- Cliente Supabase centralizado em `src/lib/supabase.ts`.
- Nenhuma chave sensível adicionada ao repositório.

## Fase 2 — Schema do banco

**Objetivo:** modelar as entidades principais no Supabase com RLS desde o início.

**Tabelas previstas:**

- `auxiliares`
- `restricoes_auxiliares`
- `rodizios`
- `rodizio_itens`
- `usuarios_auxiliares`

**Ações previstas:**

1. Criar `supabase/schema.sql`.
2. Definir chaves primárias, estrangeiras e índices.
3. Definir status do rodízio, por exemplo: `rascunho`, `publicado`, `travado`.
4. Habilitar Row Level Security em todas as tabelas.
5. Criar policies básicas:
   - admin visualiza e altera tudo;
   - auxiliar visualiza apenas rodízios publicados ou travados;
   - auxiliar visualiza seus próprios dados;
   - edição normal de rodízios travados é impedida.

**Critérios de aceite:**

- SQL versionável em `supabase/schema.sql`.
- Políticas documentadas.
- Travamento protegido no banco, não apenas na interface.

## Fase 3 — Serviços de dados

**Objetivo:** isolar acesso ao Supabase fora dos componentes React.

**Arquivos previstos:**

- `src/services/auxiliaresService.ts`
- `src/services/restricoesService.ts`
- `src/services/rodiziosService.ts`

**Funções mínimas:**

- `listarAuxiliares`
- `salvarAuxiliar`
- `listarRestricoes`
- `salvarRestricao`
- `listarRodizios`
- `obterRodizioComItens`
- `criarRodizio`
- `salvarItensRodizio`
- `publicarRodizio`
- `travarRodizio`
- `listarHistoricoTravado`

**Critérios de aceite:**

- Componentes não importam diretamente o cliente Supabase.
- Serviços possuem tratamento consistente de erros.
- Tipos de domínio continuam preservados ou são mapeados claramente.

## Fase 4 — Autenticação e perfis

**Objetivo:** permitir perfis distintos para administração e auxiliares.

**Ações previstas:**

1. Usar Supabase Auth.
2. Mapear usuários auxiliares na tabela `usuarios_auxiliares`.
3. Definir mecanismo para identificar admin, preferencialmente por metadados/perfis controlados no banco.
4. Proteger telas administrativas no frontend.
5. Garantir que RLS seja a camada definitiva de segurança.

**Critérios de aceite:**

- Auxiliar acessa apenas dados permitidos.
- Admin mantém acesso operacional completo.
- Ausência de segredo administrativo no frontend.

## Fase 5 — Tela mobile das auxiliares

**Objetivo:** disponibilizar área simples e responsiva para acesso via celular.

**Funcionalidades previstas:**

- Minha próxima escala.
- Minhas datas.
- Escala completa publicada.
- Sair.

**Critérios de aceite:**

- Layout funciona em viewport mobile.
- Dados exibidos respeitam usuário autenticado e RLS.
- Escalas em rascunho não aparecem para auxiliares.

## Fase 6 — Travamento de rodízios

**Objetivo:** impedir edição de rodízios encerrados e usá-los como histórico confiável.

**Regras previstas:**

1. Rodízio em rascunho pode ser editado.
2. Rodízio publicado pode ser visualizado.
3. Rodízio travado não pode ser editado pela interface.
4. Ao travar:
   - `status = 'travado'`
   - `travado = true`
   - `travado_em = now()`
5. Exibir aviso visual: `Rodízio travado — usado como histórico para equilíbrio das próximas escalas.`

**Critérios de aceite:**

- Interface bloqueia edição de travados.
- Banco impede atualização normal de travados.
- Histórico travado fica disponível ao algoritmo.

## Fase 7 — Algoritmo de equilíbrio

**Objetivo:** gerar sugestões usando auxiliares ativas, restrições e histórico travado.

**Arquivo previsto:**

- `src/domain/gerarRodizioEquilibrado.ts`

**A função deve considerar:**

1. Auxiliares ativas.
2. Restrições por data.
3. Histórico de rodízios travados.
4. Total de serviços por auxiliar.
5. Repetição por porta.
6. Sequência excessiva de trabalho.
7. Alertas quando não for possível cumprir todos os critérios.

**Retorno esperado:**

- Itens sugeridos.
- Alertas.
- Métricas de equilíbrio.

**Critérios de aceite:**

- Geração permite revisão manual antes de salvar.
- Algoritmo isolado de React e Supabase.
- Casos de impossibilidade geram alertas claros.

## Fase 8 — Validação final

**Objetivo:** consolidar a implementação e documentar uso operacional.

**Ações previstas:**

1. Executar `npm run build`.
2. Executar `npm run lint`, se disponível.
3. Criar `docs/RELATORIO_IMPLEMENTACAO_SUPABASE.md`.
4. Documentar:
   - resumo implementado;
   - arquivos alterados/criados;
   - comandos executados;
   - resultados dos testes/build;
   - configuração do Supabase;
   - SQL necessário;
   - variáveis de ambiente;
   - criação do primeiro usuário admin;
   - teste no celular;
   - pendências, riscos e melhorias.

**Critérios de aceite:**

- Build validado ou falha documentada com plano de correção.
- Documentação operacional completa.
- Sem commits/pushes não autorizados pelo fluxo do solicitante.
