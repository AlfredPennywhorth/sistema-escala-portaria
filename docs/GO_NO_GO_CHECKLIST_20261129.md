# Checklist operacional de Go/No-Go — meta 29/11/2026

**Situação em 21/11/2026: NO-GO para produção.** A meta continua prioritária, mas não é autorização para modificar o banco original, Neon main, Cloudflare produção ou fazer merge da PR #2.

## Evidências verificadas e trabalho já concluído
- PR #2 permanece Draft. CI anterior #44940288673 passou.
- Na branch Neon descartável `br-holy-term-b6v6ofea`, SQL05 e SQL06 têm testes básicos com JWT Admin e negativa Auxiliar, conciliados. SQL06 P01, P02, P05, P07 concluídos; não repeti-los.
- Segundo operador era perfil `coordenadora`; responsável decidiu conceder-lhe `admin`, **ainda sem comprovação de troca**. Não criar funções paralelas para Coordenadora.
- Neon main ainda precisa receber dados reais; a aplicação operacional em `src/App.tsx` segue no cliente Supabase, não no Neon. A tela Neon isolada não é a aplicação migrada.
- Há INSERT/UPDATE/DELETE direto para o papel `authenticated` e RPC legada acessível: as policies RLS são restritivas ao Admin, mas esse Admin ainda consegue contornar o controle de revisão. Fechar em migração coordenada sem revogar grants isoladamente de RPCs SECURITY INVOKER.
- Inventário real da origem Supabase **comprovado em 21/11** (9 auxiliares, 8 rodízios, 380 itens, 8 restrições, 4 vínculos associados a 3 identidades). **Backup restaurável ainda não comprovado**; procedimento em `docs/BACKUP_ORIGEM_SUPABASE_NO_COMPUTADOR_20261121.md`.
- A origem contém 8 itens históricos de 04/07/2026 sob rodízio travado iniciado em 05/07/2026; preserve o histórico. Duplicidade de um vínculo Admin não conflita em perfil ou auxiliar, mas a nova FK e UNIQUE no Neon exigem reconciliação de Auth.

## Caminho crítico para o dia 29 — ordem de execução

| Janela | Entrega objetiva | Evidência exigida |
| --- | --- | --- |
| 21–22/11 | Priorizar contrato funcional real; inventário Supabase somente leitura; conferir 2º Admin; definir plano de backup e identidade | Contagens/tabelas/identidades, backup validável, aprovação explícita de regras |
| 22–24/11 | Fechar bypass por RPC legada/DML com proposta revisada em branch Neon descartável; OCC e histórico travado | Regressão JWT + conflito `P0001` + histórico íntegro, sem DML REST direto |
| 23–25/11 | Ligar aplicação operacional ao Neon em HML isolada, com fallback bloqueado; autenticação, auxiliares, restrições, geração, salvamento, publicação, travamento e impressão | Fluxo E2E; código revisado; CI verde |
| 25–26/11 | Migrar cópia de dados e identidades para ambiente Neon isolado; reconciliar origem/destino e testar retorno | Contagens, FKs, amostras, chaves, rollback |
| 27/11 | Smoke completo de dois usuários Admin, um teste OCC, recuperação de sessão e travas do histórico | Evidências simples, sem repetir oito testes SQL06 |
| 28/11 | Checklist Go/No-Go por revisor; aprovação explícita de janela e plano de reversão | Todas as evidências, assinatura e autorização |
| 29/11 | **Somente mediante GO formal:** cutover assistido, validação funcional e monitoramento | Registro de release, reconciliação e rollback disponível |

## Gates bloqueantes para liberação
O arquivo `scripts/check-neon-release-gates.mjs` verifica um JSON de evidências; exige para cada gate `verified: true`, `evidence` não vazio e `reviewer` não vazio. Se algum gate estiver incompleto, falha com código de saída diferente de zero. **Não executar o verificador com declarações fictícias para autorizar produção.** O script atesta apenas a completude declarada dos registros: não substitui a auditoria do conteúdo, hashes, SQL ou a aprovação humana.

Gates: `source_inventory`, `restorable_source_backup`, `identity_mapping`, `migration_dry_run_reconciled`, `direct_dml_and_legacy_rpc_closed`, `jwt_two_admins_verified`, `occ_and_locked_history_verified`, `operational_ui_neon_e2e`, `rollback_rehearsed`, `ci_and_review_approved`, `release_authorized`.

Uso depois de preparar o pacote de evidências (não contém credenciais):
```bash
node scripts/check-neon-release-gates.mjs caminho/para/evidencias-go-no-go.json
```
Não incluir senhas, tokens OTP/JWT, connection strings, PII sensível ou dados da produção em arquivos versionados.

## Decisões e necessidades prioritárias
1. **Origem Supabase:** confirmar quem tem acesso de leitura/exportação, localização do projeto de origem e se existe backup restaurável. Sem isso, não há migração segura.
2. **Segundo Admin:** depois da troca realizada pelo responsável, confirmar no Neon qual ambiente foi alterado e validar login, sem promover automaticamente a produção.
3. **Contrato funcional:** aceitação das regras de edição de publicado, exclusão, proteção de histórico e operações de salvamento de itens; testes já concluídos serão reutilizados.
4. **GO de produção:** uma autorização explícita adicional será exigida após todos os gates. Não antecipar merge, deploy nem alteração de main.

## Política de simplificação dos testes
Executar manualmente apenas: segundo login Admin e um fluxo E2E representativo; uma prova de conflito OCC em fixture inédita isolada. Fazer verificações de grants, integridade, FK, contagem e backup por consultas automáticas e evidências técnicas. Não repetir P01, P02, P05, P07 nem testar Coordenadora com privilégios especiais que deixam de existir após promoção a Admin.

**Critério de parada:** qualquer diferença entre origem e destino, ausência de backup restaurável, bypass de escrita, perda de histórico, erro no ciclo operacional, ou falta de autorização de produção implica NO-GO em 29/11.

## Evidência atual de revisão — 21/11/2026 (Brasília)

- CI do HEAD `128bf1945b16a26c67d2610af9eaeaf70c3881af`: GitHub Actions run **44944544243**, `completed/success`.
- Codex respondeu em 21/11 à revisão `@codex review` do commit `544371355e`: **`Didn't find any major issues`** (issuecomment 7068530594, 17h08 BRT).
- Codex respondeu também à revisão incremental do HEAD `128bf1945b`: **`Didn't find any major issues`** (issuecomment 7070703138, 20h11 BRT). Confirmar sempre o SHA ao interpretar o review; a aprovação de commit anterior não valida alterações posteriores.
- CI e Codex sem achados críticos **não** liberam a produção, nem substituem revisão específica das mudanças de grants/RLS/RPC, ainda não feitas.
- A migração de dados reais continua NO-GO até backup restaurável, mapa das 3 identidades, ordem de importação dos 7 rodízios travados, fechamento de bypass DML/RPC, homologação operacional Neon e aprovação explícita.


## Atualização de homologação — 25/11/2026 (três contas disponíveis)

**Escopo:** evidências manuais da HML Neon isolada. Esta seção atualiza a disponibilidade real de contas e o estado dos testes; não modifica o significado dos gates anteriores nem autoriza publicação.

- **Contas efetivamente disponíveis:** 1 Administrador, 1 Coordenadora e 1 Auxiliar. Não existe segundo Administrador criado/homologado nesta etapa. Referências históricas acima à promoção da Coordenadora e ao teste de dois Administradores são planos antigos, não comprovação de execução.
- **Administrador (uma identidade):** 3 diagnósticos consecutivos com sessão estável, identidade JWT/PostgreSQL coincidente e RPC GET/POST HTTP 200 com identidade válida; 3 escalas visíveis; leitura de 2 auxiliares, rodízio publicado (3 itens) e rascunho (1 item).
- **Coordenadora (uma identidade):** 4 diagnósticos consecutivos posteriores com GET/POST válidos e sessão estável. Ocorrências anteriores alternaram `identidade_valida` e `sql_null`; a causa raiz da intermitência continua **não determinada**.
- **Auxiliar (uma identidade):** 2 diagnósticos válidos; 2 escalas visíveis; somente o próprio cadastro (1 auxiliar) e rodízio publicado (3 itens), sem rascunho ou itens de rascunho visíveis na amostra.
- **Limites da evidência:** restrições retornaram zero para Auxiliar e Admin, portanto a ausência de fixture não comprova negativa RLS; o teste de leitura não valida negativas de escrita. O encerramento de sessão apresentou `Invalid origin` e não está homologado.
- **`jwt_two_admins_verified`: PENDENTE.** Uma conta Admin validada não equivale a duas identidades administrativas independentes. Não marcar `verified: true` nem alterar o verificador para dispensar essa exigência sem decisão explícita, avaliação de riscos e evidências substitutivas aprovadas.
- **Próxima trilha segura:** preparar a matriz de testes de negativas de acesso com fixtures controladas e testes automatizados isolados; investigar logout e RPC intermitente. Sem executar DML/DDL/GRANT/REVOKE ou testes de escrita na branch Neon atual sem autorização específica.
- **NO-GO permanece:** backup restaurável, mapeamento/reconciliação, fechamento de DML/RPC legada, OCC/histórico, UI operacional Neon E2E, rollback, estabilidade e gates de produção ainda não foram comprovados integralmente.
