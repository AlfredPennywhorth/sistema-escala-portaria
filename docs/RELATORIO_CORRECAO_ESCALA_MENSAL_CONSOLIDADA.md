# Relatório de Correção: Escala Mensal Consolidada

## Problema Identificado

A tela Escala Mensal mostrava:
- "Carregado do rodízio: Maio/2026 — Travado — 44 itens"
- Mas a grade aparecia vazia, com "-" nas colunas
- O resumo mensal também não refletia os dados
- Não carregava os dias anteriores ao dia 09/05 do histórico realizado

### Causa Raiz

1. A função `buscarRodizioPorMesAno` retornava apenas o rodízio oficial (Maio/2026) com 44 itens
2. Não retornava o histórico realizado ("Histórico Realizado — 05/2026") com 12 itens
3. Não havia combinação dos dois tipos de dados

## Solução Implementada

### 1. Nova função no service: `buscarEscalaMensalConsolidada`

Arquivo: `src/services/rodiziosService.ts`

A função:
- Busca o rodízio oficial do mês
- Busca o histórico realizado do mês (identificado pelo título "Histórico Realizado")
- Consolida os itens evitando duplicidade
- Prioriza histórico realizado em caso de conflito (mesma data + porta)
- Retorna contagens separadas (oficial vs histórico)

```typescript
export async function buscarEscalaMensalConsolidada(
  ano: number,
  mes: number
): Promise<ServiceResult<EscalaMensalConsolidada | null>>
```

### 2. Atualização do EscalaView.tsx

- Substituído `buscarRodizioPorMesAno` por `buscarEscalaMensalConsolidada`
- Nova info de origem mostra breakdown: "Maio/2026 — Travado — 56 itens (44 oficial + 12 histórico)"
- Consolidação dos itens para a grade

### 3. Lógica de consolidação

```typescript
const chaveExistente = new Set<string>();

// Primeiro processa histórico (prioridade)
if (historicoRealizado) {
  await buscarEProcessarItens(historicoRealizado.id, 'historico');
  // Adiciona chaves ao set
}

// Depois processa oficial (ignora se já existe no histórico)
if (rodizioOficial) {
  await buscarEProcessarItens(rodizioOficial.id, 'oficial');
  // Pula se chave já existe
}
```

## Arquivos Alterados

1. **src/services/rodiziosService.ts**
   - Adicionada interface `ItemEscalaConsolidado`
   - Adicionada interface `EscalaMensalConsolidada`
   - Adicionada função `buscarEscalaMensalConsolidada`

2. **src/components/EscalaView.tsx**
   - Importação dos novos tipos
   - Atualização de `carregarDoSupabase` para usar nova função
   - Nova info de origem com breakdown

## Resultado do Build

```
✓ built in 1.45s
dist/index.html  679.39 kB │ gzip: 197.26 kB
```

## Resultado do Lint

```
eslint . - sucesso sem erros
```

## Como Validar no App

1. Abrir Escala Mensal
2. Verificar se os dias 02/05, 03/05 e 05/05 aparecem (se existirem no histórico realizado)
3. Verificar os dias a partir de 09/05 com os nomes das auxiliares
4. Verificar se Entrada/Galeria/Lateral/Sanitário estão preenchidos
5. Verificar resumo mensal com totais diferentes de zero
6. Verificar informação de origem: "Maio/2026 — Travado — 56 itens (44 oficial + 12 histórico)"
7. Abrir Rodízios e confirmar que continua funcionando

## Como Validar no Supabase

### Query A: Rodízios do mês
```sql
select 
  r.id,
  r.titulo,
  r.status,
  r.travado,
  count(ri.id) as total_itens
from rodizios r
left join rodizio_itens ri on ri.rodizio_id = r.id
group by r.id, r.titulo, r.status, r.travado
order by r.created_at desc;
```

### Query B: Itens de maio
```sql
select 
  r.titulo,
  r.status,
  r.travado,
  ri.data,
  ri.porta,
  a.nome as auxiliar
from rodizios r
join rodizio_itens ri on ri.rodizio_id = r.id
left join auxiliares a on a.id = ri.auxiliar_id
where extract(month from ri.data) = 5
  and extract(year from ri.data) = 2026
order by ri.data, r.titulo, ri.porta;
```

## Pendências

Nenhuma pendência identificada.

## Riscos

- A função usa identificação por título "Histórico Realizado" - pode falhar se o título mudar no futuro
- Performance pode ser afetada se houver muitos rodízios travados no banco (busca todos os travados do mês)