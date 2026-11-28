# Inventário mínimo de migração — Supabase → Neon (21/11/2026)

## Estado
**Origem Supabase: NÃO INVENTARIADA; backup restaurável: NÃO COMPROVADO.**
Não executar cutover/merge/deploy a partir de CI verde ou de contagens artificiais da branch descartável.

## Ferramenta preparada e validada
`migration/neon/tests/08_source_destination_inventory_readonly.sql` contém **um SELECT**, sem alterações em tabelas, grants ou autenticação. É compatível com o modelo das cinco tabelas de negócio em `supabase/schema.sql`; não exporta registros ou PII. CI protege seu caráter exclusivamente de leitura via `tests/neon-data-inventory.test.mjs`.

Inventário na **branch descartável do Neon**, executado por SELECT real em 21/11:
- `auxiliares=2`; `restricoes_auxiliares=0`; `rodizios=10`; `rodizio_itens=9`; `usuarios_auxiliares=3`.
- Estados: rascunho 5; publicado 2; travado 2; cancelado 1.
- Perfis: admin 1; coordenadora 1; auxiliar 1. A promoção do segundo operador ainda não aparece.
- Invariantes: zero intervalos invertidos, zero itens sem rodízio/auxiliar, zero restrições órfãs, zero itens fora do período, zero travados sem flag.
- **Dados exclusivamente fictícios**; não representam contagens da origem e não demonstram migração real.

## Próxima coleta indispensável — usuário com acesso ao Supabase
1. Abrir o projeto **Supabase de origem**, no painel de banco de dados (**SQL Editor**), com acesso apropriado. Confirmar visualmente que é a origem do aplicativo, não banco Neon ou ambiente de testes.
2. Copiar o SQL de `migration/neon/tests/08_source_destination_inventory_readonly.sql` e executar como **consulta somente leitura**.
3. Guardar o resultado de `contagens`, `status_rodizios`, `perfis` e `inconsistencias`. Esses campos são agregados e não contêm dados de pessoas. Registrar data/hora, identificador do projeto de origem (sem chave/segredo) e tipo de banco.
4. Em etapa separada, verificar backup **restaurável** de esquema, dados, histórico e vínculos de identidades. O inventário agregado não é backup. Confirmar snapshots/exportação e como restaurar numa instância isolada, sem alterar origem.
5. Só então preparar ensaio de migração dos dados para branch Neon isolada, preservando UUIDs e vínculos, comparando contagens, chaves, restrições, datas, histórico travado e correspondência de usuários entre provedores de autenticação.
6. **Não** enviar token JWT/OTP, API service role, string de conexão, senhas ou dumps com dados pessoais diretamente em comentários públicos de PR.

## Critérios de aceite para avançar
- Origem identificada e inventário obtido, com inexistência de inconsistências não explicadas.
- Backup com teste de restauração comprovado, não somente arquivo exportado.
- Identidade e mapeamento do segundo administrador verificáveis; não atualizar perfil no Neon main ou produção sem autorização separada.
- Proposta de migração de esquema/dados revisada, ensaio isolado e rollback recuperável.
- Bloqueios de DML direto e RPC legada fechados de forma **coordenada**; não revogar privilégios isoladamente enquanto funções são SECURITY INVOKER.
- Aplicação funcional realmente conectada ao Neon na HML, não apenas a tela `?rpc-branch-test=1`.

## Plano da meta 29/11
A obtenção das contagens e do backup da origem é o próximo bloqueio do caminho crítico. Em paralelo, preparar integração funcional e migração segura em PR #2. Em 28/11 emitir GO apenas com evidências completas e aprovação específica. Se algum gate bloquear, manter a produção Supabase atual funcionando.

Nenhuma instrução aqui autoriza alterações no Supabase original, Neon main, HML principal ou produção.

## Confirmação da origem via conector Supabase (21/11/2026)

A conexão Supabase foi realizada pelo responsável. O projeto **sistema-escala-portaria** foi identificado sem ambiguidade: ref `pjjrsfnchpizlezrliyw`, região `sa-east-1`, criado em 09/05/2026, estado **INACTIVE**. A ação independente `get_project` confirmou `INACTIVE`.

Tentativas estritamente de leitura de `list_tables(public)` e `execute_sql(SELECT COUNT(...))` falharam com `Database is possibly not accessible at the moment`. **Nenhum dado foi alterado e nenhuma contagem da origem foi obtida.** Não afirmar que origem está vazia ou que backup está disponível.

O conector oferece `restore_project`, mas restaurar/reativar o projeto de origem é mudança operacional com impacto em disponibilidade e potencial custo; **não foi executada**. Antes, solicitar autorização explícita limitada a restaurar/retomar somente `pjjrsfnchpizlezrliyw`, sem alterações de tabelas, usuários ou configurações. Após estado `ACTIVE_HEALTHY`, executar exclusivamente `08_source_destination_inventory_readonly.sql`, inventário de auth apenas agregado e verificar backup restaurável por procedimento documentado.

**Bloqueio crítico do Go/No-Go 29/11:** origem Supabase inativa; contagens, integridade real, mapeamento de identidades e backup ainda não comprovados.

## Reativação autorizada — 21/11/2026

O usuário autorizou explicitamente a reativação **exclusiva** de `pjjrsfnchpizlezrliyw` para inventário de **somente leitura**, sem mudar tabelas, usuários ou configurações. A ação `restore_project` retornou `success=true`. `get_project` logo após retornou `COMING_UP`, indicando inicialização em curso; **não equivale a ACTIVE_HEALTHY**, nem comprova ainda acesso aos dados. Nenhuma SQL mutante foi executada. A próxima ação, apenas quando o status estiver `ACTIVE_HEALTHY`, é executar o arquivo `08_source_destination_inventory_readonly.sql` para registrar contagens e integridade agregadas. A validação de backup restaurável continua separada.

## Inventário real após reativação — 21/11/2026

A origem Supabase `pjjrsfnchpizlezrliyw` passou a `ACTIVE_HEALTHY`. Foi executado o **SELECT somente leitura** de `migration/neon/tests/08_source_destination_inventory_readonly.sql`, sem escrever dados.

Contagens confirmadas **na origem**, não na branch Neon descartável:
- `auxiliares=9`, `restricoes_auxiliares=8`, `rodizios=8`, `rodizio_itens=380`, `usuarios_auxiliares=4`.
- Estados dos 8 rodízios: `travado=7`, `publicado=1`, `rascunho=0`, `cancelado=0`.
- Vínculos: `admin=4`, `coordenadora=0`, `auxiliar=0`. Auth.users: **3 identidades distintas**; zero identidades sem vínculo e zero vínculos órfãos, porém há **um usuário com dois vínculos** administrativos (duplicidade de associação), que precisa ser reconciliado antes de provisionar usuários Neon.
- Cinco tabelas de negócio com RLS habilitada.
- Integridade: sem itens órfãos, sem referências a auxiliares inexistentes, sem restrições órfãs, sem rodízios com período invertido e sem rodízios travados com flag incoerente.
- Exceção histórica: **8 itens em 04/07/2026** ligados a um único rodízio **travado** cujo período declarado vai de **05/07/2026 a 31/07/2026**. UUID do cabeçalho `af183833-3012-4d33-849a-0dd2fdae07e4`. **Não alterar nem eliminar histórico:** resolver contratualmente se é divergência legítima/erro de cabeçalho antes de migração definitiva.
- Todos os 8 rodízios têm itens.
- Inventário não equivale a backup restaurável. Captura do dashboard Supabase indica `Last Backup: No backups`; **ainda não há backup restaurável comprovado**.

**Diferença Neon main:** último inventário da main Neon teve 0 auxiliares, rodízios, itens e vínculos. Os 10 rodízios/9 itens do Neon descartável são fixtures sintéticas, **não são os dados da origem**.

**Bloqueios atualizados para 29/11:** obter backup/restauração testados; revisar duplicidade de `usuarios_auxiliares` sem expor identidade; preservar 8 itens históricos fora do período; mapear corretamente as 3 identidades Auth antes de migração; concluir integração do app operacional ao Neon e fechar DML/RPC legadas. Nenhuma alteração executada nos dados de origem.

## Comparação estrutural pré-migração (21/11/2026)

Consultado `information_schema.columns` em Supabase origem `pjjrsfnchpizlezrliyw` e Neon branch descartável `br-holy-term-b6v6ofea`, apenas SELECT. As cinco tabelas de negócio totalizam **38 colunas de origem** e **39 no destino de teste**; única coluna adicional no Neon: `rodizios.revisao` para OCC. Nenhuma coluna da origem ausente no Neon. Não foram detectadas diferenças de tipo SQL ou nulidade nas 38 colunas comuns.

Este exame é estrutural e parcial: não substitui comparação de defaults, CHECKs, chaves únicas, políticas RLS, gatilhos, funções, índices, permissões ou teste de migração de dados. A coluna extra `revisao` exige regra explícita de inicialização para rodízios existentes e preservação de histórico.

Backup para computador documentado em `docs/BACKUP_ORIGEM_SUPABASE_NO_COMPUTADOR_20261121.md`, conforme comandos do Supabase CLI; nenhum dump/restauração executado nesta sessão.
