# Relatório de Correção: Renderização da Escala Mensal

## 1. Problema Original
A tela de **Escala Mensal** não exibia corretamente os nomes das auxiliares quando os dados eram carregados do Supabase. Além disso, a grade e o resumo mensal não refletiam os dados consolidados (oficial + histórico realizado), e datas específicas do histórico não apareciam na visualização.

## 2. Causa Raiz Confirmada
- **Incompatibilidade de IDs:** O sistema usava IDs estáticos (numéricos ou strings curtas) na `store` local, enquanto o Supabase utiliza UUIDs.
- **Mapeamento Incompleto:** A função de mapeamento de portas não tratava variações de nomes de portas (acentuação/caixa).
- **Dados Fragmentados:** A tela buscava apenas o rodízio oficial, ignorando o histórico realizado que complementa os dias não cobertos pelo rodízio planejado.
- **Resolução de Nomes:** Não havia uma busca ativa pelos nomes das auxiliares no banco de dados para os registros que não constavam na lista inicial da store.

## 3. Arquivos Alterados
- `src/components/EscalaView.tsx`: Refatoração completa da lógica de carregamento, mapeamento e renderização.
- `src/services/rodiziosService.ts`: Implementação/Ajuste de `buscarEscalaMensalConsolidada` para unir dados oficiais e históricos.

## 4. Fluxo de Dados do Supabase
1. O componente chama `rodiziosService.buscarEscalaMensalConsolidada(ano, mes)`.
2. O serviço busca o rodízio oficial do mês e o histórico realizado ("Fechamento").
3. Os itens são unidos em uma lista única, priorizando o oficial para dias planejados e o histórico para dias realizados.
4. O componente recebe o objeto `EscalaMensalConsolidada` com todos os itens.

## 5. Resolução de Nomes das Auxiliares
Os nomes são resolvidos através de um mapa dinâmico (`auxiliaresSupabase`):
- Primeiramente, tenta obter o nome vindo diretamente do item consolidado (se disponível).
- Consulta o serviço `auxiliaresService.listarAuxiliares()` para carregar todos os nomes atuais do banco.
- Fallback para a `store` local se o ID for conhecido.
- Resultado final: O nome real aparece na grade em vez de UUIDs ou "-".

## 6. Conversão de Itens para a Grade
- Os itens consolidados são convertidos para o formato interno da aplicação através da função `itensConvertidos.map`.
- As portas são normalizadas (ex: "Sanitário" -> "l4") usando `MAPA_PORTA_PARA_LOCAL_ID`.
- A grade agrupa os dados por data e localId, garantindo que cada célula seja preenchida corretamente.

## 7. Cálculo do Resumo Mensal
- O resumo é calculado no `useMemo` com base na lista de `escalas` já populada com dados consolidados.
- Considera todas as auxiliares encontradas (locais + banco), evitando que auxiliares externas fiquem de fora dos totais.

## 8. Histórico Realizado
- O histórico realizado entra na tela através da consolidação no serviço.
- Dias como 02/05, 03/05 e 05/05 (presentes no histórico) são incluídos na lista de itens e, consequentemente, renderizados na grade.

## 9. Resultado do Build
- **Status:** Sucesso.
- **Comando:** `npm run build`
- **Saída:** Bundle gerado corretamente em `dist/`.

## 10. Resultado do Lint
- **Status:** Sucesso (sem erros impeditivos).
- **Comando:** `npm run lint`

## 11. Testes Manuais Obrigatórios
- [x] Navegação entre meses (Maio/2026, Abril/2026).
- [x] Verificação de nomes na grade (Ex: nomes completos aparecendo).
- [x] Conferência de totais no resumo (Soma de batidas por porta).
- [x] Verificação do status "Carregado do rodízio..." no cabeçalho.
- [x] Impressão da escala (CSS print validado).

## 12. Pendências
- Nenhuma pendência crítica identificada para esta correção.

---
**Data:** 09/05/2026
**Status:** Concluído
