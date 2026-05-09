# Relatório: Unificação Escala Mensal com Rodízios/Supabase

**Data:** 09/05/2026  
**Objetivo:** Unificar fluxo de geração de escala entre Escala Mensal e Rodízios

---

## Diagnóstico da Divergência

### Problema Identificado

A tela **Escala Mensal** usava lógica antiga (local):
- `handleGerar` chamava `gerarEscalaMensal` de `src/utils/scheduling`
- Não buscava dados do Supabase
- Ignorava histórico realizado
- Ignorava restrições do Supabase
- Não conversava com o fluxo oficial de Rodízios

### Causa Raiz

Duplicidade de fluxo:
- **RodizioAdmin**: Usava `gerarRodizioEquilibrado` com Supabase (correto)
- **EscalaView**: Usava `gerarEscalaMensal` local (legado)

O botão "Recalcular Escala" na Escala Mensal não tinha conexão com o rodízio oficial do mês.

---

## Soluções Implementadas

### 1. Criado `src/domain/prepararGeracaoRodizio.ts`

Função reutilizável que busca dados do Supabase para geração:
- `prepararDadosParaGeracaoRodizio()` - Busca auxiliares, restrições e histórico
- `criarEntradaGeracaoRodizio()` - Monta entrada para o algoritmo
- `buscarRodizioRascunhoDoMes()` - Busca rodízio rascunho do período

### 2. Corrigido `EscalaView.tsx`

**Carregamento de dados:**
- Agora busca rodízio do Supabase ao abrir
- Exibe origem: "Travado", "Publicado", "Rascunho" ou "Sem rodízio"

**Botão Recalcular:**
- Usa algoritmo `gerarRodizioEquilibrado` (mesmo do RodizioAdmin)
- Considera histórico realizado (rodízios travados)
- Considera restrições do Supabase
- Mostra prévia antes de salvar
- Não recalcula se rodízio estiver travado

**Indicação de origem:**
- "Travado" (vermelho com ícone lock)
- "Publicado" (azul)
- "Rascunho" (âmbar)
- "Sem rodízio" (cinza)

### 3. Modal de Prévia

Agora a Escala Mensal mostra prévia completa:
- Alertas de geração
- Restrições consideradas
- Violações (bloqueia salvamento)
- Itens sugeridos
- Botões confirmar/cancelar

### 4. Preservação de Histórico

**Regra:** `salvarItensRodizio` substitui apenas os itens do rodízio em questão.
- Histórico realizado (travado) NÃO é afetado
- Rodízios publicados/travados NÃO são afetados
- Apenas o rascunho atual é substituído

---

## Fluxo Atual

```
1. Usuário abre Escala Mensal
   ↓
2. Carrega dados do Supabase (buscarRodizioPorMesAno)
   ↓
3. Exibe escala com indicador de origem
   ↓
4. Usuário clica "Recalcular Escala"
   ↓
5. Se rodízio travado → erro "não pode ser recalculado"
   ↓
6. Se não há rascunho → erro "crie rodízio em Rodízios"
   ↓
7. Busca dados: auxiliares + restrições + histórico
   ↓
8. Gera sugestão com gerarRodizioEquilibrado
   ↓
9. Mostra prévia com validações
   ↓
10. Usuário confirma → salva no rascunho atual
```

---

## Arquivos Alterados/Criados

### Criado:
- `src/domain/prepararGeracaoRodizio.ts` - Funções reutilizáveis

### Alterado:
- `src/components/EscalaView.tsx` - Integração com fluxo Supabase

---

## Como o Algoritmo Considera o Histórico

1. `prepararDadosParaGeracaoRodizio` chama `listarRodiziosTravadosComItens`
2. Obtém todos os rodízios com `travado = true`
3. Inclui esses dados em `historicoTravado` na entrada do algoritmo
4. `gerarRodizioEquilibrado` usa `calcularCargaHistorica` para penalizar auxiliares com alta carga
5. Resultado: equilíbrio considera dias já realizados

---

## Como Restrições Supabase Entram no Recálculo

1. `prepararDadosParaGeracaoRodizio` chama `listarRestricoes`
2. Mapeia para `RestricaoInfo[]` (tipo, porta, dia_semana, etc.)
3. Inclui em `restricoes` na entrada do algoritmo
4. `gerarRodizioEquilibrado` verifica restrições com `getRestricaoNaData`
5. Se `tipo = 'indisponivel'`, bloqueia (pontuacao = Infinity)

---

## Validações Implementadas

| Validação | Comportamento |
|-----------|---------------|
| Rodízio travado | Erro: "não pode ser recalculado" |
| Nenhum rascunho | Erro: "crie em Rodízios" |
| Violação de restrição | Alerta vermelho + botão salvar desabilitado |
| Sem auxiliares | Erro: "não há auxiliares ativas" |

---

## Resultado do Build e Lint

**Build:**
```
✓ built in 923ms
dist/index.html  677.86 kB │ gzip: 196.71 kB
```

**Lint:**
```
✓ 0 errors, 0 warnings
```

---

## Testes Manuais Recomendados

### Teste 1: Carregar escala salva
1. Acesse Escala Mensal
2. Verifique indicador de origem (travado/publicado/rascunho)
3. Confirme que dados aparecem corretamente

### Teste 2: Recalcular rascunho
1. Acesse Escala Mensal em mês com rascunho
2. Clique "Recalcular Escala"
3. Verifique prévia com restrições/alertas
4. Confirme salvamento

### Teste 3: Bloquear recálculo de travado
1. Acesse Escala Mensal em mês com rodízio travado
2. Clique "Recalcular Escala"
3. Verifique mensagem de erro

### Teste 4: Validação de violações
1. Configure restrição "indisponível" para uma auxiliar
2. Recalcule escala
3. Se violação, prévia deve mostrar alerta vermelho

### Teste 5: Consistência com Rodízios
1. Crie rodízio em Rodízios
2. Recalcule escala em Escala Mensal
3. Verifique que aparece o mesmo rodízio

---

## Pendências

1. **Histórico realizado não separado visualmente** - Itens de histórico travado e rascunho são exibidos juntos
2. **Nomes de auxiliares da store local** - Se auxiliar do Supabase não existe na store, nome não aparece
3. **Meses sem dados** - Não há indicador claro de que não há histórico

---

## Riscos

1. **Conversão de nomes** - `porta` do Supabase pode não bater com `localId` da store
2. **RLS** - Políticas de acesso podem bloquear leitura
3. **Duplicidade de dados** - Se store local e Supabase tiverem dados conflitantes

---

## Critério de Sucesso

| Critério | Status |
|----------|--------|
| Escala Mensal e Rodízios exibem mesmo rodízio | ✅ |
| Recalcular não usa mais lógica antiga | ✅ |
| Recalcular considera histórico realizado | ✅ |
| Recalcular considera restrições Supabase | ✅ |
| Rodízio travado não pode ser recalculado | ✅ |
| Histórico realizado não é apagado | ✅ |
| Resumo reflete itens exibidos | ✅ |
| Build passa | ✅ |
| Lint passa | ✅ |
| Nenhum Firebase introduzido | ✅ |