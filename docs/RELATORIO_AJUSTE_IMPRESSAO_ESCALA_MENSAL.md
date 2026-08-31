# Relatório de Ajuste: Otimização de Impressão da Escala Mensal

Este documento detalha os ajustes realizados para otimizar a visualização de impressão e geração de PDF da tela "Escala Mensal".

## Objetivo
Garantir que a escala mensal e o quadro resumo caibam em 1 ou 2 páginas A4 no modo paisagem, com design limpo, sem elementos de interface desnecessários (sidebar, navegação, avisos técnicos) e com fontes compactas.

## Alterações Realizadas

### 1. Estilos Globais (`src/index.css`)
- Adicionado bloco `@media print` abrangente.
- Configurado `@page { size: A4 landscape; margin: 8mm; }`.
- Removido sombras (`box-shadow: none`) e arredondamentos excessivos (`border-radius: 4px`) para um visual mais profissional em papel.
- Forçada a cor de fundo branca e ajuste de cores de impressão (`print-color-adjust: exact`).
- Criada classe `.print-header-compact` para reduzir o cabeçalho (logo e título).
- Implementada redução de fontes global para tabelas em modo de impressão (9px).
- Adicionada regra `page-break-inside: avoid` para evitar que linhas de tabela sejam cortadas entre páginas.

### 2. Layout Principal (`src/components/Layout.tsx`)
- Adicionada classe `no-print` ao `aside` (Sidebar) e à barra de navegação mobile.
- Isso garante que apenas o conteúdo útil seja renderizado no container de impressão já existente.

### 3. Componente de Escala (`src/components/EscalaView.tsx`)
- Envolvido o conteúdo principal na classe `print-container`.
- Aplicada a classe `no-print` em:
  - Botões de navegação de mês.
  - Botão "Recalcular Escala".
  - Botão "Imprimir".
  - Mensagens de status técnico ("Carregado do Supabase", etc).
  - Rodapé com observações do algoritmo e ações de fechamento.
- Aplicadas classes de redução de escala específicas:
  - Título do mês reduzido de `text-4xl` para `text-2xl`.
  - Logo CCB reduzido de `h-24` para `h-12`.
  - Padding das células da tabela reduzidos para o mínimo necessário.
  - Ajuste de cores das colunas de fim de semana para tons mais suaves/cinzas em vez de azul vibrante.

### 4. Componente de Verificação (`src/components/ConfigCheck.tsx`)
- Adicionada classe `no-print` ao widget flutuante "Supabase configurado", removendo poluição visual do canto inferior do PDF.

## Resultado Esperado
Ao clicar em "Imprimir":
- O layout mudará automaticamente para paisagem.
- A sidebar desaparecerá.
- O cabeçalho ocupará menos espaço.
- A tabela principal será mais densa, permitindo mais linhas por página.
- O quadro resumo aparecerá logo abaixo da tabela principal.
- Não haverá URLs de localhost, botões ou avisos de sistema no documento.
