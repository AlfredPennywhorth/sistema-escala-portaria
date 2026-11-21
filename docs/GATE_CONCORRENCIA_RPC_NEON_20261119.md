# Concorrência da gravação de rascunhos Neon — gate antes da integração

Status: **não homologado; não habilitar gravação na tela operacional**.

## Risco identificado

A RPC `public.substituir_itens_rodizio_rascunho` executa `SELECT ... FOR UPDATE` sobre a escala e depois substitui todos os itens, na mesma transação. Isso garante que duas chamadas não modifiquem a mesma escala *simultaneamente* no banco e evita a metade de um DELETE+INSERT.

**Mas não evita a perda de atualizações.** Se dois Administradores lerem a mesma versão A, o primeiro salvar B e o segundo salvar C com a versão A ainda aberta, a segunda transação poderá substituir silenciosamente B por C após adquirir o lock. Resultado atômico não significa ausência de sobrescrita.

## Critério obrigatório para solução

- Implementar controle de versão no banco (por exemplo, inteiro `revision` da escala atualizado sob bloqueio), ou hash/snapshot esperado passado à RPC e comparado **dentro do mesmo lock**, antes de executar DELETE.
- A operação deve receber a versão que o cliente leu ao abrir o editor, não consultar uma nova versão *imediatamente antes* da escrita; isso mascararia conflito.
- Se a versão for divergente, devolver erro explícito de conflito (`409` no contrato da API quando disponível, com código SQL/documentação própria), **sem excluir ou inserir item algum**.
- Não fazer repetição automática quando a escrita falhar ou quando o status de rede for incerto; exigir recarregar escala, resolver divergências e confirmar de novo.
- Manter autorização por JWT/RLS, apenas `rascunho` não travado e `SECURITY INVOKER`. Não conceder privilégios a `anonymous`.
- O versionamento/controle de concorrência deve cobrir todas as rotas que possam alterar itens, publicar ou travar a mesma escala, não somente a RPC.

## Matriz de teste

1. Dois clientes autenticados como administradores leem revisão A.
2. Cliente 1 grava B com revisão A: sucesso; revisão da escala passa a A+1.
3. Cliente 2 tenta gravar C com revisão A: conflito, sem alteração; B preservado.
4. Cliente 2 recarrega revisão A+1 e grava C conscientemente: sucesso.
5. Uma entrada inválida/erro de FK durante substituição não consome revisão nem altera itens.
6. Conflito entre publicação/travamento e substituição: somente uma operação prossegue; não permitir publicar/travar um conjunto desatualizado.
7. Falha de transporte depois do commit: reconciliar revisão e conteúdo, sem repetir às cegas.

## Separação de ambientes

O fluxo atual `src/components/RodizioAdmin.tsx` ainda utiliza `src/services/rodiziosService.ts` (Supabase legado). A fachada `src/services/neon/rodizioFunctionalHmlService.ts` está deliberadamente desconectada dessa tela. A RPC atual foi aplicada **apenas** à branch Neon descartável `br-holy-term-b6v6ofea` para homologar atomicidade e permissões.

**Nenhum teste de concorrência real foi executado até aqui.** É proibido declarar esse gate aprovado com base apenas no `FOR UPDATE`, no CI ou nos resultados de JWT dos três perfis.
