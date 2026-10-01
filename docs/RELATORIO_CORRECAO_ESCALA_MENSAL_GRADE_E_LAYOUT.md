# Relatório de Correção: Escala Mensal Grade e Layout Badge

## 1. Causa da Grade Vazia

O problema estava no mapeamento dos nomes das portas para os IDs dos locais na grade.

### Estrutura esperada pela Escala Mensal:
A grade usa `escalaPorData` que agrupa por data e localId. O objeto `escalas` precisa ter:
- `data`: string (ex: "2026-05-09")
- `localId`: string (ex: "l1", "l2", "l3", "l4")
- `colaboradoraId`: string (id da auxiliar)

Os IDs dos locais na store são:
- l1 = Entrada
- l2 = Galeria
- l3 = Lateral
- l4 = Sanitário

### Estrutura recebida do Supabase:
O serviço `buscarRodizioPorMesAno` retorna `RodizioComItens` com itens contendo:
- `data`: string
- `porta`: string (ex: "Entrada", "Galeria", "Lateral", "Sanitário")
- `auxiliar`: { id, nome }

### Problema identificado:
Na conversão dos itens do Supabase (linha 91-103 do EscalaView.tsx), o código usava diretamente `item.porta` como `localId`. Isso causava uma incompatibilidade:
- Porta: "Entrada", "Galeria", etc.
- Esperado: "l1", "l2", etc.

Como resultado, ao renderizar a grade, a busca por `escalaPorData[dataStr][l.id]` não encontrava correspondência, pois os IDs não coincidiam.

## 2. Como foi feita a conversão

 foi implementada uma função de normalização e um mapa de conversão:

```typescript
const MAPA_PORTA_PARA_LOCAL_ID: Record<string, string> = {
  'entrada': 'l1',
  'galeria': 'l2',
  'lateral': 'l3',
  'sanitário': 'l4',
  'sanitario': 'l4',
};

const normalizarPorta = (porta: string): string => {
  return porta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};
```

A conversão agora:
1. Normaliza a porta (minúsculas, remove acentos)
2. Usa o mapa para obter o ID correto
3. Mantém fallback para o valor original se não encontrar correspondência

## 3. Como o resumo mensal passou a ser calculado

O resumo mensal (useMemo na linha 235-251) já estava correto, pois usa o mesmo array `escalas` que é populado pela conversão dos itens do Supabase. Como a correção do mapeamento fez os nomes das auxiliares aparecerem na grade, o resumo também passou a funcionar corretamente, pois agora cada item tem o `localId` correto que corresponde aos IDs dos locais.

## 4. Como o layout do badge Administrador foi corrigido

O problema era que o container do AuthStatus não tinha largura máxima definida e não usava flex-wrap. O badge e o email ficavam em linha reta e podiam ultrapassar a sidebar.

Correções aplicadas no AuthStatus.tsx:
- Changed `flex items-center gap-3` to `flex flex-wrap items-center gap-2 max-w-full`
- Added `min-w-0` and `shrink-0` ao container do email
- Reduziu o `max-w-32` para `max-w-[140px]` para garantir mais espaço ao email
- Added `shrink-0` ao badge de perfil

Isso permite que os elementos façam wrap quando necessário e evita overflow horizontal.

## 5. Arquivos alterados

1. **src/components/EscalaView.tsx**
   - Adicionado MAPA_PORTA_PARA_LOCAL_ID e normalizarPorta
   - Corrigida conversão de itens (linha ~95-107)
   - Adicionado infoOrigem para exibir origem dos itens

2. **src/components/AuthStatus.tsx**
   - Corrigido layout do container para usar flex-wrap
   - Ajustadas larguras e shrink dos elementos

## 6. Resultado do build

```
✓ built in 1.31s
dist/index.html  678.49 kB │ gzip: 196.93 kB
```

## 7. Resultado do lint

```
eslint . - sucesso sem erros
```

## 8. Testes manuais recomendados

1. Abrir Escala Mensal para Maio/2026
2. Confirmar que as colunas Entrada, Galeria, Lateral e Sanitário estão preenchidas com nomes
3. Confirmar que o resumo mensal tem valores diferentes de zero
4. Confirmar que o total do resumo bate com os itens exibidos
5. Confirmar que aparece "Carregado do rodízio: Maio/2026 — Travado — X itens"
6. Confirmar que o badge Administrador não invade mais a tela central
7. Abrir Rodízios e confirmar que continua funcionando

## 9. Pendências

Nenhuma pendência identificada. As correções foram realizadas conforme solicitado, sem alterar algoritmo, schema SQL, restrições ou RLS.