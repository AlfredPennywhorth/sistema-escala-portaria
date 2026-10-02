# Explicação do Algoritmo de Equilíbrio

**Data:** 09 de maio de 2026  
**Versão:** 1.0

---

## 1. Visão Geral

O algoritmo de equilíbrio (`gerarRodizioEquilibrado`) é uma função pura que gera sugestões de rodízio considerando múltiplos fatores para garantir distribuição justa do trabalho entre as auxiliares.

**Características:**
- Função pura (sem efeitos colaterais)
- Sem dependência do Supabase
- Sem dependência de React
- Retorna métricas e alertas detalhados
- Permite configuração de pesos

---

## 2. Entradas

### 2.1. Dados Obrigatórios

| Campo | Descrição |
|-------|-----------|
| `dataInicio` | Data de início do período (ISO) |
| `dataFim` | Data de fim do período (ISO) |
| `portas` | Lista de portas/locais disponíveis |
| `diasAtivos` | Lista de dias da semana ativos (ex: ["Domingo", "Terça-Feira", "Sábado"]) |
| `auxiliares` | Lista de auxiliares ativas |
| `restricoes` | Lista de restrições cadastradas |
| `historicoTravado` | Lista de rodízios travados (histórico) |

### 2.2. Dados Opcionais

| Campo | Descrição |
|-------|-----------|
| `periodos` | Lista de períodos do dia (manhã, tarde, noite) |
| `configuracoes` | Pesos personalizados para a fórmula de pontuação |

---

## 3. Tipos de Restrições

O algoritmo trata cada tipo de restrição de forma específica:

| Tipo | Comportamento | Penalidade/Bônus |
|------|---------------|-------------------|
| `indisponivel` | BLOQUEIO absoluto | Não é considerada como candidata |
| `evitar` | Penalidade alta | +4 pontos na pontuação |
| `preferencia` | Bônus | -6 pontos na pontuação |
| `observacao` | Neutro | 0 pontos (apenas informativo) |

---

## 4. Fórmula de Pontuação

A cada escolha de auxiliar para uma vaga, o algoritmo calcula:

```
pontuacao =
  cargaHistorica × pesoHistorico
  + cargaNovoRodizio × pesoNovoRodizio
  + repeticoesPorta × pesoRepeticaoPorta
  + penalidadeSequencia
  + penalidadeRestricao
```

### 4.1. Componentes

| Componente | Descrição | Peso Default |
|------------|-----------|--------------|
| `cargaHistorica` | Total de escalas no histórico | 10 |
| `cargaNovoRodizio` | Total de escalas no novo rodízio | 8 |
| `repeticoesPorta` | Vezes que trabalhou na mesma porta | 6 |
| `penalidadeSequencia` | Dias desde último trabalho | 5-8 |
| `penalidadeRestricao` | Tipo da restrição | 0 a +4 |
| `bonusPrefencia` | Se tiver preferência | -6 |

### 4.2. Penalidade de Sequência

| Dias desde último trabalho | Penalidade |
|---------------------------|------------|
| 0 (mesmo dia) | 8 pontos |
| 1 (dia anterior) | 4 pontos |
| 2-3 dias | 2.5 pontos |
| 4+ dias | 0 pontos |

### 4.3. Seleção

A auxiliar com **MENOR pontuação** é selecionada, pois:
- Menos trabalho no histórico = menor pontuação
- Menos trabalho no novo rodízio = menor pontuação
- Menos repetições = menor pontuação
- Mais distância do último trabalho = menor pontuação

---

## 5. Tratamento do Histórico Travado

O histórico travado é fundamental para o equilíbrio:

1. **Contagem Total:** Para cada auxiliar, conta-se quantas vezes aparece em todos os rodízios travados
2. **Uso na Fórmula:** A carga histórica entra na pontuação com peso alto (10)
3. **Priorização:** Auxiliares com menos histórico têm mais chance de ser escolhidas
4. **Alerta de Ausência:** Se não houver histórico, gera aviso para o administrador

### Exemplo

```
Rodízio Travado 1: Auxiliar A (3x), Auxiliar B (5x)
Rodízio Travado 2: Auxiliar A (2x), Auxiliar C (4x)

Total histórico:
- Auxiliar A: 5 vezes
- Auxiliar B: 5 vezes
- Auxiliar C: 4 vezes

Nova escala: Auxiliar C será priorizada por ter menos carga histórica
```

---

## 6. Tratamento de Restrições

### 6.1. Indisponibilidade (`indisponivel`)

```
SE auxiliar.temRestricaoNaData(data, 'indisponivel'):
  RETORNAR pontuacao = INFINITO
  (Bloqueia a candidata completamente)
```

### 6.2. Evitar (`evitar`)

```
SE auxiliar.temRestricaoNaData(data, 'evitar'):
  ADICIONAR +4 pontos à pontuação
  (Ainda pode ser escolhida se não houver alternativa)
```

### 6.3. Preferência (`preferencia`)

```
SE auxiliar.temRestricaoNaData(data, 'preferencia'):
  SUBTRAIR 6 pontos da pontuação
  (Prioriza esta auxiliar dentro do equilíbrio)
```

### 6.4. Observação (`observacao`)

```
SE auxiliar.temRestricaoNaData(data, 'observacao'):
  NENHUMA alteração na pontuação
  (Apenas informativo, não afeta escolha)
```

---

## 7. Gerenciamento de Alertas

O algoritmo gera alertas para diversas situações:

### 7.1. Tipos de Alerta

| Tipo | Cor | Severidade |
|------|-----|------------|
| `erro` | Vermelho | Crítico - impede geração |
| `aviso` | Amarelo | Atenção - verificar |
| `info` | Azul | Informativo |

### 7.2. Códigos de Alerta

| Código | Tipo | Significado |
|--------|------|-------------|
| `SEM_HISTORICO` | aviso | Não há rodízios travados |
| `ITENS_FALTANTES` | erro | Vagas sem candidata disponível |
| `SEM_AUXILIARES` | erro | Nenhuma auxiliar cadastrada |
| `AUXILIARES_NOVAS` | info | Há auxiliares sem histórico |
| `DATAS_BLOQUEADAS` | erro | Todas candidatas bloqueadas |
| `DESEQUILIBRIO` | aviso | Carga muito acima da média |
| `RESTRICOES_IGNORADAS` | info | Restrições evitar ignoradas |
| `SEM_CANDIDATA` | erro | Vaga específica sem opção |

---

## 8. Métricas Retornadas

Para cada auxiliar, o algoritmo calcula:

| Métrica | Descrição |
|---------|-----------|
| `totalHistorico` | Total de escalas no histórico |
| `totalNovo` | Total de escalas no novo rodízio |
| `totalGeral` | Soma do histórico + novo |
| `mediaGeral` | Média entre todas as auxiliares |
| `desvio` | Diferença da média |
| `rankEquilibrio` | Posição no ranking (1 = menos carga) |

---

## 9. Exemplo de Uso

```typescript
import { gerarRodizioEquilibrado } from './domain/gerarRodizioEquilibrado';
import type { EntradaGeracaoRodizio } from './types/geracaoRodizio';

const entrada: EntradaGeracaoRodizio = {
  dataInicio: '2026-06-01',
  dataFim: '2026-06-30',
  portas: [
    { id: 'p1', nome: 'Entrada' },
    { id: 'p2', nome: 'Galeria' },
    { id: 'p3', nome: 'Sanitário' },
  ],
  diasAtivos: ['Domingo', 'Terça-Feira', 'Sábado'],
  auxiliares: [
    { id: 'a1', nome: 'Maria' },
    { id: 'a2', nome: 'Joana' },
    { id: 'a3', nome: 'Ana' },
  ],
  restricoes: [
    { id: 'r1', auxiliarId: 'a1', data: '2026-06-10', tipo: 'indisponivel', motivo: 'Férias' },
    { id: 'r2', auxiliarId: 'a2', data: '2026-06-15', tipo: 'preferencia', motivo: 'Compromisso' },
  ],
  historicoTravado: [
    {
      id: 'h1',
      titulo: 'Maio 2026',
      dataInicio: '2026-05-01',
      dataFim: '2026-05-31',
      itens: [
        { rodizioId: 'h1', data: '2026-05-03', porta: 'Entrada', auxiliarId: 'a1' },
        { rodizioId: 'h1', data: '2026-05-03', porta: 'Galeria', auxiliarId: 'a2' },
        // ... mais itens
      ],
    },
  ],
};

const resultado = gerarRodizioEquilibrado(entrada);

console.log(resultado.itens);     // Sugestões de escala
console.log(resultado.alertas);   // Alertas gerados
console.log(resultado.metricas);  // Métricas de equilíbrio
console.log(resultado.resumo);    // Resumo geral
```

---

## 10. Considerações Finais

### 10.1. Ordem dos Locais

Os locais são sorteados (`shuffle`) a cada dia para evitar vício de posição.

### 10.2. Candidatas

As candidatas também são sorteadas antes de ordenar por pontuação, garantindo variabilidade quando há empate.

### 10.3. Pontuação Infinita

Quando uma auxiliar é bloqueada por restrição `indisponivel`, retorna-se `Infinity` para excluí-la das candidatas.

### 10.4. Personalização

Os pesos podem ser ajustados via parâmetro `configuracoes` para atender necessidades específicas da comunidade.

---

## 11. Comparação com Algoritmo Atual

| Aspecto | Algoritmo Atual | Algoritmo Novo |
|---------|----------------|----------------|
| Histórico Travado | Não | Sim |
| Restrições Personalizadas | Básico | Completo |
| Métricas Detalhadas | Não | Sim |
| Alertas | Não | Sim |
| Configuração de Pesos | Não | Sim |
| Integração Supabase | Não | Futura |

---

## 12. Próximos Passos

1. Integrar com `rodiziosService.salvarItensRodizio`
2. Expor botão para gerar com novo algoritmo
3. Permitir выбор between algoritmos (temporário)
4. Coletar feedback após uso em produção