# RELATÓRIO DE CORREÇÃO: RESUMO DUPLICADO NA ESCALA MENSAL

## 1. Causa da Duplicidade
A duplicidade ocorria porque o componente `EscalaView.tsx` utilizava o ID da colaboradora (`colaboradoraId`) como chave primária para agrupar os dados do resumo. Como o sistema está em fase de transição, uma mesma auxiliar podia possuir dois IDs diferentes:
- Um ID numérico legado (ex: '2') vindo da `store` local (`zustand`).
- Um ID UUID vindo do Supabase.

Ao combinar as fontes de dados, o `Set` de IDs continha ambas as chaves, resultando em duas linhas para a mesma pessoa (uma com os dados locais, geralmente zerados, e outra com os dados do Supabase).

## 2. Fontes Misturadas
- `colaboradoras` da store local (`useStore`).
- `auxiliaresSupabase` (mapa de IDs para nomes carregado via serviço).
- `escalas` (lista consolidada de itens de rodízio).

## 3. Deduplicação
A deduplicação foi implementada utilizando o **nome normalizado** da auxiliar como chave de agrupamento em um `Map`.
Foi criada a função `normalizarNomeAuxiliar` que realiza:
- Conversão para minúsculas.
- Remoção de acentos (normalize NFD).
- Trim de espaços nas extremidades.
- Substituição de múltiplos espaços internos por um único espaço.

## 4. Cálculo do Resumo
O resumo agora segue o seguinte fluxo:
1. Inicializa um `Map<string, LinhaResumo>` onde a chave é o nome normalizado.
2. Itera sobre os itens consolidados das `escalas`:
   - Obtém o nome da auxiliar (da store ou do mapa do Supabase).
   - Normaliza o nome.
   - Incrementa os contadores específicos para a porta/local do item.
3. Itera sobre as colaboradoras da store local para garantir que nomes que não tiveram atividade no mês também apareçam (com valores zerados), mas sem duplicar se já existirem no mapa.
4. Converte o `Map` em um array ordenado alfabeticamente para exibição.

## 5. Validação dos Totais
Foram adicionados `console.debug` para monitorar a consistência:
- `total itens consolidados`: Quantidade de registros na grade principal.
- `total geral resumo`: Soma de todos os totais individuais no quadro resumo.
Estes dois valores devem ser idênticos.

## 6. Arquivos Alterados
- `src/components/EscalaView.tsx`

## 7. Resultados Técnicos
- **Build**: Passou 100% (Vite + TSC).
- **Lint**: Passou 100% (ESLint). Foram corrigidos tipos `any` e avisos de dependência de `useCallback` para garantir máxima estabilidade.

## 8. Testes Manuais Recomendados
1. Acessar a tela **Escala Mensal**.
2. Verificar se o nome "Bruna Gasque" (ou qualquer outro que estivesse duplicado) aparece apenas uma vez.
3. Somar os totais da coluna "Total" no resumo e comparar com a quantidade de itens na grade (ou com o log no console).
4. Validar se auxiliares sem atividade no mês continuam aparecendo no resumo com valor 0.
