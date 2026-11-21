# Auditoria de compatibilidade Supabase → Neon — 21/11/2026

**Escopo:** catálogos SQL da origem Supabase `pjjrsfnchpizlezrliyw` e branch Neon descartável `br-holy-term-b6v6ofea`; **somente leitura**. Nenhum comando DDL, DML, migração ou alteração de autenticação foi executado.

## Evidências

### Colunas
38 colunas compartilhadas nas 5 tabelas públicas de negócio, com tipos e nulidade equivalentes. Neon acrescenta `rodizios.revisao` (OCC), que exige valor inicial e validação de monotonicidade. Diferenças de defaults não foram abrangidas pela primeira comparação.

### Chaves, integridade e identidades — bloqueio P0
- A origem possui PKs, FKs e checks de perfil/status/restrição equivalentes em geral.
- `usuarios_auxiliares.user_id` **não possui constraint UNIQUE na origem**, mas no Neon há `usuarios_auxiliares_user_id_unique`.
- Inventário origem: 4 registros de vínculo para 3 identidades Auth; uma identidade possui 2 vínculos. **Copiar os quatro vínculos para Neon falharia ou violaria a unicidade.**
- `usuarios_auxiliares.user_id` referencia `auth.users(id)` na origem e `neon_auth."user"(id)` no Neon. A simples preservação do UUID da origem sem provisionar/correlacionar a identidade de destino provocaria falha FK. **Não migrar autenticação por SQL direto ou trocar a FK sem plano próprio.**
- Solução proposta, não aplicada: após verificar quais vínculos pertencem à mesma identidade e se há diferenças semânticas, mapear a identidade para uma conta Neon Auth e gerar **um único vínculo por identidade**. Preservar trilha de auditoria restrita dos registros originais e comprovar os logins; nunca presumir que 4 vínculos equivalem a 4 pessoas.
- Não há autorização para alterar `usuarios_auxiliares` em produção.

### Histórico e gatilhos — bloqueio P0
- Supabase: `trg_proteger_rodizio_travado_update/delete` e `trg_proteger_itens_rodizio_travado_update/delete`.
- Neon: gatilhos análogos para UPDATE/DELETE, e também INSERT dos itens via `trg_bloquear_itens_travados`. **Não enfraquecer a proteção de históricos travados.**
- 8 itens reais têm data 04/07/2026, enquanto o cabeçalho do rodízio travado começa 05/07/2026. Importação deve preservar fielmente esses itens históricos; não executar edição corretiva no Supabase e não rejeitar silenciosamente registros legítimos por uma validação de data projetada para novas edições. A decisão sobre anomalia é separada.
- A simples presença de triggers não substitui teste de restauração e de bloqueio de alteração após importar.

### Policies/RLS
- A origem tem 5 tabelas com RLS ativa e policies `is_admin()` / `is_coordenadora()`, com várias declarações para `PUBLIC`; Neon usa policies voltadas ao papel `authenticated` e `usuario_tem_perfil()`/Neon Auth.
- O Neon permite leitura de itens/rodízios publicados a usuário vinculado; a origem listada tem regras diferentes de leitura. Exigir verificação de papéis efetivos, inclusive se o consumo da interface depender dessa ampliação. Não copiar policies da origem literalmente.
- **A lacuna de DML direto e da RPC legada no Neon permanece aberta**; a presença de RLS não equivale a garantia OCC. Resolver por migração coordenada com revisão independente, não por REVOKE isolado sobre funções SECURITY INVOKER.

### Índices
- `idx_restricoes_ativa` (índice parcial sobre `restricoes_auxiliares(ativa) WHERE ativa=true`) existe na origem e não na branch Neon comparada. Proposta: inspecionar plano de consulta e criar no destino somente se beneficiar o acesso real; não é prova de incompatibilidade dos dados.
- Origem `idx_usuarios_auxiliares_user_id` é índice não único; destino possui índice único que substitui a finalidade de busca, mas altera a semântica de duplicidade.

## Próxima sequência sem backup / sem mudanças de dados
1. Adicionar preflight somente leitura que conte duplicidades, índices e integridade, sem retornar PII.
2. Preparar mapa de migração de identidades em artefato privado, após definição de estratégia Neon Auth. Não publicar IDs/e-mails em PR.
3. Investigar o conjunto de gatilhos e validações de inserção para assegurar importação histórica íntegra.
4. Executar testes automatizados de contratos em CI, sem depender do computador do usuário.
5. Quando houver backup **restaurado com êxito em ambiente isolado**, ensaiar cópia controlada; preservar origem e Neon main até Go/No-Go autorizado.

**Estado:** NÃO está pronta a importação de dados ou identidades; PR #2 continua Draft. A meta de 29/11 não autoriza bypass de integridade, backup ou autenticação.
