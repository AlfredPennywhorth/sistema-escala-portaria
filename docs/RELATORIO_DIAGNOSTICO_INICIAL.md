# Relatório de Diagnóstico Inicial

Data da execução: 2026-05-09 01:08:03 UTC
Etapa: 1 — Apenas diagnóstico

## 1. Escopo executado

Esta etapa realizou somente diagnóstico e documentação. Não houve alteração de regra de negócio, componentes, tipos, store, utilitários ou configuração de build. Foram criados apenas arquivos em `docs/`.

## 2. Comandos obrigatórios executados antes de alterar documentação

| Comando | Resultado |
|---|---|
| `git status` | Executado. Branch `work`, árvore inicialmente limpa. |
| `git branch` | Executado. Branch atual: `work`. |
| `git remote -v` | Executado. Não retornou remotes configurados. |
| `git log --oneline -n 5` | Executado. Retornou 2 commits no histórico local. |
| `npm install` | Executado, mas ficou sem concluir e precisou ser interrompido por travamento após longo tempo sem saída adicional. Houve warnings de configuração `http-proxy` desconhecida e possível `MaxListenersExceededWarning`. |
| `npm run build` | Executado separadamente após o travamento do install. Falhou por ausência dos type definitions `vite/client` e `node`. |

## 3. Resultado detalhado dos comandos

### 3.1 `git status`

```text
On branch work
nothing to commit, working tree clean
```

### 3.2 `git branch`

```text
* work
```

### 3.3 `git remote -v`

```text
Sem saída: nenhum remote configurado.
```

### 3.4 `git log --oneline -n 5`

```text
1b274e9 fix: title synchronization using persistent state
e95e16d feat: complete schedule system v4 with fixed round-robin, ccb logo and date overflow fix
```

### 3.5 `npm install`

Primeira execução dentro do bloco obrigatório:

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
(node:3938) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 socket listeners added to [ClientRequest]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
```

A execução permaneceu sem concluir e foi encerrada manualmente por processo externo.

Segunda tentativa com `timeout 90s npm install`:

```text
node_modules-existe
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
(node:3998) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 socket listeners added to [ClientRequest]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
```

A segunda tentativa também permaneceu travada além do tempo esperado e foi encerrada por processo externo.

### 3.6 `npm run build`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> sistema-escala-portaria@0.0.0 build
> tsc -b && vite build

error TS2688: Cannot find type definition file for 'vite/client'.
  The file is in the program because:
    Entry point of type library 'vite/client' specified in compilerOptions
error TS2688: Cannot find type definition file for 'node'.
  The file is in the program because:
    Entry point of type library 'node' specified in compilerOptions
```

**Status do build:** falhou.

## 4. Stack detectada

- Aplicação frontend em React.
- TypeScript.
- Vite.
- Tailwind CSS via `@tailwindcss/vite` e importação `@import "tailwindcss"`.
- Zustand com middleware `persist` para estado local.
- date-fns para datas.
- lucide-react para ícones.
- vite-plugin-singlefile para empacotamento em arquivo único.
- ESLint configurado e script `npm run lint` disponível.

## 5. Componentes principais

- `src/App.tsx`: roteamento simples em estado local entre páginas `escala`, `colaboradoras` e `configuracoes`.
- `src/components/Layout.tsx`: estrutura geral, menu lateral, top bar mobile e área de impressão.
- `src/components/EscalaView.tsx`: visualização e geração da escala mensal, impressão, navegação de mês, resumo e confirmação de histórico.
- `src/components/ColaboradorasManager.tsx`: cadastro, edição, remoção e restrições das colaboradoras.
- `src/components/Configuracoes.tsx`: gestão de locais/portas e informações da localidade.

## 6. Onde estão os dados atuais

Os dados atuais estão centralizados em `src/store/useStore.ts`, com estado persistido no navegador por Zustand persist usando a chave `escala-portaria-storage`.

Dados iniciais identificados:

- `INITIAL_COLABORADORAS`: lista fixa de colaboradoras iniciais, restrições e `cargaAcumulada`.
- `INITIAL_LOCAIS`: lista fixa de locais: Entrada, Galeria, Lateral e Sanitário.
- `diasAtivos`: Domingo, Terça-Feira e Sábado.
- `localidade`: Jardim Santo Eduardo.
- `escalas`: array em estado local/persistido.
- `dataAlvo`: mês corrente como ISO string.

## 7. localStorage, Zustand, JSON local ou estado em memória

- Existe Zustand em `src/store/useStore.ts`.
- Existe persistência local via `persist` do Zustand.
- A chave usada no armazenamento local é `escala-portaria-storage`.
- Não foi identificado arquivo JSON local para dados operacionais.
- Também há estado em memória nos componentes para formulários, navegação e cálculos derivados.

## 8. Como o rodízio é gerado hoje

A geração atual ocorre por `gerarEscalaMensal` em `src/utils/scheduling.ts`, chamada por `EscalaView` ao clicar em `Recalcular Escala`.

Resumo do algoritmo atual:

1. Calcula início e fim do mês escolhido.
2. Filtra dias ativos com base em `diasAtivos`.
3. Calcula total de vagas e média ideal por colaboradora.
4. Embaralha locais do dia para reduzir viés.
5. Embaralha candidatas e filtra por:
   - restrição de dia;
   - restrição de local;
   - já escalada no mesmo dia.
6. Calcula score penalizando:
   - carga mensal alta;
   - repetição no mesmo local;
   - trabalho no dia imediatamente anterior do calendário;
   - repetição do último local;
   - acima/abaixo da média ideal.
7. Escolhe a menor pontuação para cada local.
8. Retorna array de turnos (`Turno[]`).

Observação: o algoritmo atual considera apenas a escala em geração e os dados persistidos localmente; ele não consulta histórico travado em banco.

## 9. Como as auxiliares são cadastradas hoje

O cadastro é feito em `src/components/ColaboradorasManager.tsx`.

Fluxo atual:

1. Usuário informa nome.
2. Seleciona restrições de dia e/ou local.
3. Ao salvar:
   - se estiver editando, chama `updateColaboradora`;
   - se for nova, chama `addColaboradora` com `crypto.randomUUID()`.
4. A carga acumulada inicial de nova colaboradora é `0`.
5. Remoção usa `removeColaboradora` diretamente.

## 10. Como as restrições são tratadas hoje

As restrições ficam dentro de cada colaboradora no formato:

```ts
interface Restricao {
  dia?: DiaSemana[];
  local?: string[];
}
```

Na geração da escala, uma candidata é removida se:

- `c.restricoes.dia` contém o dia da semana da data;
- `c.restricoes.local` contém o nome do local/porta.

Atualmente as restrições são por dia da semana e por nome de local. Não há restrição específica por data civil no modelo atual.

## 11. Riscos para migrar para Supabase

1. **Build já falha no estado atual:** o projeto não compila por ausência de type definitions `vite/client` e `node`, provavelmente por instalação incompleta ou `node_modules` inconsistente.
2. **`npm install` travando:** a instalação não concluiu no ambiente atual, com warnings relacionados a proxy/configuração npm.
3. **Modelo atual embute restrições na colaboradora:** a futura tabela `restricoes_auxiliares` exigirá mapeamento entre restrições atuais e linhas normalizadas.
4. **Identificadores locais são strings aleatórias:** será necessário decidir se os IDs serão UUIDs do banco e migrar referências em escalas/rodízios.
5. **Sem entidade formal de rodízio mensal:** hoje existe apenas `escalas: Turno[]`; será preciso introduzir `rodizios` e `rodizio_itens` sem quebrar a interface.
6. **Sem status de rodízio:** não há `rascunho`, `publicado` ou `travado`; a regra precisará ser adicionada com cuidado.
7. **Histórico atual é simplificado:** `cargaAcumulada` fica na colaboradora e é incrementada ao confirmar, mas não há histórico auditável por rodízio travado.
8. **RLS depende de autenticação bem modelada:** policies incorretas podem bloquear o app ou expor dados indevidos.
9. **Auxiliares mobile exigem autenticação/perfil:** a relação entre usuário autenticado e auxiliar precisa ser inequívoca.
10. **Conflito offline/localStorage vs Supabase:** dados locais existentes podem divergir do banco se não houver plano de migração.
11. **Algoritmo usa aleatoriedade:** resultados podem variar entre execuções; ao usar histórico travado será importante registrar métricas e alertas.
12. **Travamento deve existir também no banco:** bloquear apenas na UI não é suficiente.

## 12. Critério de parada aplicado

Como o `npm run build` falhou e `npm install` não concluiu de forma confiável, a implementação deve parar após o diagnóstico. Antes da Etapa 2, recomenda-se corrigir o ambiente de dependências/build ou confirmar uma estratégia para reinstalação limpa.

## 13. Próximo passo recomendado

Antes da Etapa 2 — Supabase:

1. Verificar configuração npm/proxy do ambiente.
2. Reinstalar dependências de forma limpa se autorizado, por exemplo removendo `node_modules` e executando `npm install` novamente.
3. Confirmar que `@types/node`, `vite` e demais dependências estão presentes em `node_modules`.
4. Executar `npm run build` até passar.
5. Só então instalar `@supabase/supabase-js` e criar arquivos de integração.
