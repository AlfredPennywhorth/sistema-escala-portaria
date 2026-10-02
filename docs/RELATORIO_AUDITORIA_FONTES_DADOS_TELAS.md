# Relatório de Auditoria: Fontes de Dados por Tela

## Tabela de Fontes de Dados

| Tela/Componente | Fonte de dados | Service usado | Usa Supabase? | Usa store local? | Campos esperados | Campos recebidos | Problemas encontrados |
|-----------------|----------------|---------------|---------------|-------------------|------------------|------------------|----------------------|
| Escala Mensal | Supabase (buscarRodizioPorMesAno) + Store (colaboradoras, locais) | rodiziosService.buscarRodizioPorMesAno | ✅ Sim | ✅ Sim (colaboradoras, locais) | data, localId (l1-l4), colaboradoraId | data, porta, auxiliar.id/nome | ❌ Não carrega histórico realizado; ❌ não combina rodízio oficial + histórico; ❌ usa store local legada para colaboradoras em vez de auxiliares do Supabase |
| Rodízios (Admin) | Supabase (listarRodizios, obterRodizioComItens) | rodiziosService | ✅ Sim | ❌ Não | id, titulo, status, travado, data_inicio, data_fim | id, titulo, status, travado, data_inicio, data_fim | ✅ OK |
| Auxiliares (Admin) | Supabase (listarAuxiliares) | auxiliaresService | ✅ Sim | ❌ Não | id, nome, telefone, email, ativa, observacoes | id, nome, telefone, email, ativa, observacoes | ✅ OK |
| Área da Auxiliar | Supabase (buscarEscalaPorAuxiliar) | areaAuxiliarService | ✅ Sim | ❌ Não | data, porta, nome da auxiliar | data, porta, auxiliar_id | ✅ OK |
| Colaboradoras (Legado) | Store local (useStore) | useStore (colaboradoras) | ❌ Não | ✅ Sim | id, nome, restricoes, cargaAcumulada | id, nome, restricoes, cargaAcumulada | ⚠️ Legado, não usado na nova implementação |
| Configurações | Store local (useStore) | useStore (locais, diasAtivos, ...) | ❌ Não | ✅ Sim | localidades, diasAtivos | configurações locais | ⚠️ Legado |

## Divergências Identificadas

### Escala Mensal vs Rodízios

1. **Dados carregados:**
   - Rodízios: Usa `obterRodizioComItens` ou `listarRodiziosTravadosComItens` para buscar itens com auxiliares
   - Escala Mensal: Usa `buscarRodizioPorMesAno` que retorna apenas o rodízio oficial

2. **Histórico realizado:**
   - Rodízios: Lista todos os rodízios travados incluindo histórico realizado
   - Escala Mensal: **NÃO carrega** "Histórico Realizado — 05/2026"

3. **Colaboradoras:**
   - Escala Mensal: Usa `colaboradoras` da store local (legado)
   - Deveria usar: `auxiliares` do Supabase para correspondência correta com `colaboradoraId`

## Causa da Grade Vazia

1. A função `buscarRodizioPorMesAno` retorna apenas o rodízio oficial (Maio/2026) com 44 itens
2. Não retorna o histórico realizado (12 itens dos dias 02/05, 03/05, 05/05)
3. Mesmo os 44 itens do rodízio oficial não estão aparecendo porque:
   - A conversão de itens foi parcialmente corrigida na sessão anterior
   - MAS a busca não está retornando os dados corretamente do Supabase

## Solução Necessária

1. Criar função `buscarEscalaMensalConsolidada(ano, mes)` que:
   - Busque o rodízio oficial do mês
   - Busque o histórico realizado do mês
   - Consolide os itens (evitando duplicidade)
   - Priorize histórico realizado em caso de conflito

2. Atualizar EscalaView para usar a nova função

3. Verificar se a correspondência de colaboradoras está correta

## Consultas SQL para Conferência

### A) Rodízios do mês
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

### B) Itens de maio
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