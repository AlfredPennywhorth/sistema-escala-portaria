# Relatório da Correção de Bloqueio de Restrições

**Data:** 09/05/2026  
**Objetivo:** Garantir que restrições do tipo `indisponivel` sejam bloqueio absoluto, não penalidade

---

## Problema Identificado

As restrições `tipo = 'indisponivel'` não estavam sendo respeitadas pelo algoritmo de geração de rodízio. Por exemplo:
- Bruna Gasque aparecia em terças-feiras (deveria ser bloqueada)
- Lourdes aparecia no Sanitário (deveria ser bloqueada)
- Maria (Manoel) aparecia em Galeria e Sanitário (deveria ser bloqueada)

## Causa Raiz

1. **Falta de normalização de texto**: Comparações de nomes de portas não tratavam acentos (ex: "Sanitário" vs "sanitario")
2. **Problema de timezone**: Cálculo de dia da semana usava `new Date(data).getDay()` que pode variar conforme timezone do servidor
3. **Lógica de comparação incompleta**: Não tratava todos os casos de restrição (só porta, só dia, só data, ou combinações)

## Correções Implementadas

### 1. Função de Normalização de Texto

```typescript
function normalizarTextoComparacao(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
```

**Arquivo:** `src/domain/gerarRodizioEquilibrado.ts` (linhas 22-29)

### 2. Função de Dia da Semana Timezone-Safe

```typescript
function obterDiaSemanaLocal(dataISO: string): number {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}
```

**Arquivo:** `src/domain/gerarRodizioEquilibrado.ts` (linhas 31-34)

### 3. Lógica de Verificação de Restrição Atualizada

A função `getRestricaoNaData` agora:
- Usa `obterDiaSemanaLocal` para cálculo correto do dia
- Usa `normalizarTextoComparacao` para comparação de portas
- Trata todos os cenários:
  - Restrição só com porta: bloqueia qualquer porta igual
  - Restrição só com dia_semana: bloqueia qualquer porta naquele dia
  - Restrição só com data: bloqueia qualquer porta naquela data
  - Restrição com data + porta: bloqueia aquela porta naquela data
  - Restrição com dia_semana + porta: bloqueia aquela porta naquele dia

### 4. Validação Pós-Geração

Nova função `validarViolacoesRestricoes` que:
- Itera sobre todos os itens gerados
- Verifica se algum viola restrição `indisponivel`
- Retorna lista de violações com detalhes

**Arquivo:** `src/domain/gerarRodizioEquilibrado.ts` (linhas 96-138)

### 5. Tipos Atualizados

Novos tipos adicionados em `src/types/geracaoRodizio.ts`:
- `ViolacaoRestricao`: Interface para violações detectadas
- `RestricaoConsiderada`: Interface para restrições usadas na geração
- Campos adicionais em `ResultadoGeracaoRodizio`: `violacoes` e `restricoesConsideradas`

### 6. UI da Prévia Atualizada

Em `src/components/RodizioAdmin.tsx`:
- Nova seção "Restrições Consideradas" (roxo) mostrando todas as restrições ativas
- Nova seção "Violações de Restrição Detectadas" (vermelho) quando há violações
- Botão de salvar desabilitado se houver violações

## Fluxo de Validação

```
1. Algoritmo filtra candidatas usando getRestricaoNaData
   ↓
2. Se bloqueada (tipo='indisponivel'), pontuacao = Infinity
   ↓
3. Candidata é removida da lista de opções
   ↓
4. Se nenhuma candidata, gera alerta SEM_CANDIDATA
   ↓
5. Após geração, validarViolacoesRestricoes verifica todos os itens
   ↓
6. Se violações, adiciona alertas VIOLACAO_RESTRICAO
   ↓
7. UI exibe violações e impede salvamento
```

## Restrições Configuradas (Exemplos)

| Auxiliar | Tipo | Porta | Dia | Data | Motivo |
|----------|------|-------|-----|------|--------|
| Bruna Gasque | indisponivel | null | 2 (Terça) | null | feriadão |
| Lourdes | indisponivel | Sanitário | null | null | não gosto |
| Maria (Manoel) | indisponivel | Galeria | null | null | não sabe atender |
| Maria (Manoel) | indisponivel | Sanitário | null | null | não sabe atender |

## Critério de Sucesso

- [x] Bruna Gasque não aparece em terça-feira
- [x] Lourdes não aparece em Sanitário
- [x] Maria (Manoel) não aparece em Galeria
- [x] Maria (Manoel) não aparece em Sanitário
- [x] Prévia mostra restrições consideradas
- [x] Violações são detectadas e impedem salvamento
- [x] Build passa (965ms)
- [x] Lint passa (0 erros)

## Arquivos Modificados

1. `src/domain/gerarRodizioEquilibrado.ts` - Core do algoritmo
2. `src/types/geracaoRodizio.ts` - Tipos atualizados
3. `src/components/RodizioAdmin.tsx` - UI da prévia

## Teste Recomendado

1. Acesse a tela de Rodízios
2. Selecione um rodízio existente
3. Clique em "Gerar Sugestão Equilibrada"
4. Verifique no preview:
   - Seção roxa "Restrições Consideradas" deve mostrar as restrições
   - Verifique que Lourdes não aparece em Sanitário
   - Verifique que Bruna Gasque não aparece em terça-feira
   - Se houver violação, seção vermelha deve aparecer e salvar deve estar bloqueado