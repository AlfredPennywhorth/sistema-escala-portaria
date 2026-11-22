# Caminho crítico — Neon em produção até 29/11/2026

**Plano atualizado em 22/11/2026. Estado: PROPOSTA DE EXECUÇÃO, NÃO AUTORIZAÇÃO DE MUDANÇA.** O requisito é ter o sistema **inteiramente operante em Neon** até 29/11; manter Supabase apenas como origem preservada e plano de retorno, **não como entrega-alvo**. Prazo não elimina gates. Se faltar evidência, declarar NO-GO mesmo em 29/11.

## Base verificada
- PR #2 `chore/neon-migration-prep-20261115` permanece Draft, sem merge; HEAD antes deste documento `d1fc42c69f782e8e8747a78d1df105adad59474e`; CI `45038275976` passou; Codex revisou o SHA sem novos achados importantes. Todo novo commit exige reconfirmação de CI e revisão técnica correspondente.
- Runtime principal `src/App.tsx` usa `useAuth` e componentes operacionais Supabase por padrão; `src/hooks/useAuth.ts` importa `supabase` e `authService`. Telas Neon Auth/RPC estão segregadas por flag de homologação e host. **Não afirmar que a aplicação operacional Neon está integrada.**
- Existe serviço Neon `src/services/neon/rodizioFunctionalHmlService.ts` de listagem, leitura com reconfirmação de revisão e substituição versionada em HML; não está ligado à UI principal.
- SQL13 REVIEW_ONLY revisada, baseline state-first MD5 `b06899977f63be59f8c993b05d134498`, target revision-first MD5 `f2100180626d8fd8881aebb99ca57d0d`; **não executada**.
- SQL12 REVIEW_ONLY revisada estaticamente; **não executada**. DML direto `authenticated` em `rodizios`/`rodizio_itens` e EXECUTE da RPC legada ainda são bypass P0.
- Origem Supabase `pjjrsfnchpizlezrliyw`: 9 auxiliares, 8 restrições, 8 rodízios, 380 itens, 4 vínculos associados a 3 identidades. Um usuário tem vínculo duplicado sem conflito detectado de perfil/auxiliar, mas Neon exige UNIQUE(user_id); FK Neon Auth exige mapeamento explícito. Sete rodízios travados, um publicado; oito itens históricos datados 04/07/2026 com cabeçalho iniciado 05/07/2026 **devem ser preservados integralmente**.
- Backup restaurável da origem ainda não realizado; documento `docs/BACKUP_ORIGEM_SUPABASE_NO_COMPUTADOR_20261121.md`. Dumps padrão não transportam automaticamente Neon Auth.
- Neon alvo exclusivo dos ensaios: projeto `blue-sky-02214231`, branch descartável `br-holy-term-b6v6ofea`, DB `rodizio_portas`. Neon main `br-lively-lab-b69kz252` preservada até autorização específica de produção.
- Domínio Cloudflare de homologação existe, porém fluxo completo de login/e-mail e integração operacional Neon **não foram homologados**.
- **Nada deste plano autoriza SQL, snapshot, DDL/DML, troca de roles, dados reais, mudança em Neon main, merge ou deploy de produção.**

## Estratégia de execução em frentes paralelas
- **Trilha A — Aplicação Neon (código na PR):** preparar abstração/adaptadores por domínio para auth, auxiliares, restrições, rodízios, itens e relatórios/impressão. Isolar ativação por ambiente, sem fallback silencioso Supabase; CI de ambos os builds. Pode avançar sem banco real.
- **Trilha B — Segurança e SQL (branch Neon descartável):** operacionalizar runbook SQL13, autorizar e homologar, depois revisar/autorizar SQL12 coordenada. Suspensão de ingressos -> drenagem comprovada -> snapshot de corte recuperável -> execução isolada -> teste JWT/OCC. SQL12 depende da homologação SQL13, nunca paralelizar DDL dessas duas.
- **Trilha C — Backup, identidades e dados:** exportação Supabase em computador autorizado, restauração em ambiente isolado, mapa privado 3 identidades -> Neon Auth e quatro vínculos -> três vínculos, ensaio de importação e reconciliação. Preparar scripts *offline* e checks sem alterar dados enquanto gates não liberados.
- **Trilha D — Homologação e release:** JWT de dois Admins, login por e-mail, negativa Auxiliar, fluxos E2E, impressão, dados históricos, integridade, RLS, concorrência, recuperação de sessão; go/no-go independente e cutover assistido.

## Agenda com entregáveis e gates
| Data (São Paulo) | Trilha / entrega objetivamente exigida | Pode ocorrer em paralelo? | Critério de saída |
| --- | --- | --- | --- |
| **22/11** | Baseline de código, mapa de dependências, priorização e decisão de papéis; especificar entregas sem mudanças de ambiente | Sim | PR Draft, plano, CI e revisão no HEAD |
| **23/11** | A: interface Neon preparada sob flag e serviços; C: iniciar backup em computador autorizado, testar envio de código/login HML **somente quando autorizado**; B: janela SQL13 com inventário de ingressos e rollback | Sim, sem conflitar bancos | Builds/CI e checklist de backup; identificar se e-mail requer correção do provedor |
| **24/11** | C: restauração isolada do backup, checks/identidades; B: solicitar autorização específica, executar SQL13 apenas após ordem suspensão/drenagem/snapshot, e homologar JWT/OCC | A/C paralelas; execução B serializada | Evidência restaurável + SQL13 com P0001/42501 se autorizada |
| **25/11** | B: revisão final, autorização e homologação **separada** SQL12; A: completar telas e fluxos Neon HML isolados | Sim, vedar DDL paralelo | bypass DML/RPC antiga fechado; sete RPCs legítimas seguem utilizáveis |
| **26/11** | C: cópia **experimental isolada** de dados/identidades após backup e autorização, preservar 8 itens anômalos, 7 travados e IDs; A: integrar leitura/escrita/impressão | Sim, apenas ambiente destinado ao ensaio | contagens, FK, status, hashes/amostras e logins reconciliados |
| **27/11** | D: smoke de 2 Admins, Auxiliar, recuperação de sessão, OCC real, fluxo completo de escalas e impressão, indisponibilidade/timeout | Não repetir básicos SQL06 já aprovados sem justificativa | regressão crítica zero, nenhuma escrita direta, histórico intacto |
| **28/11** | D: última revisão CI/Codex, restore/rollback ensaiado, evidências preenchidas e Go/No-Go formal | Não | todos os gates independentes verificados por revisor e autorização explícita |
| **29/11** | Cutover de produção **somente sob GO formal**; snapshot/backup de corte, reconciliação final, janela de escrita congelada, migração assistida, smoke e monitoramento | Sequência estrita | Neon operacional e dados conciliados; se falhar, abortar/reverter com autorização e registro |

## Precedências (não negociáveis)
1. Dados reais **não** saem da origem para ensaio antes de backup restaurável comprovado e autorização específica.
2. SQL13 HML autorizada e homologada **antes** de SQL12 HML. SQL12 não deve ser promovida sem JWT real e provas contra DML direto, RPC legada e bypass de RLS.
3. Qualquer snapshot de corte pós-suspensão/drenagem, com timestamps e restauração possível; snapshot velho não substitui ponto consistente.
4. Neon Auth exige vínculo de identidade verificável: 3 identidades distintas, 4 vínculos legados deduplicados durante migração, sem registrar PII ou UUIDs reais no GitHub.
5. A importação histórica respeita triggers de travamento: desenhar/ensaiar ordem segura numa instância isolada, sem desligar triggers no Supabase ou descartar registros antigos.
6. Interface operacional só aponta à Neon após passar build, login real, leitura, escrita versionada, histórico, impressão e testes negativos. **Não usar fallback silencioso a Supabase**.
7. A migração de produção requer autorização adicional: PR merge, branch Neon main, alterações de privilégios e deploy são ações independentes, cada uma com seu gate.

## Ordem de trabalho da implementação da UI (código apenas)
1. Inventariar componentes e imports diretos de `supabase`, `useAuth`, `services/*`; mapear por tela e perfil. Produzir matriz de cobertura: funcionalidade atual -> adaptador Neon -> testes.
2. Criar contrato de autenticação Neon separado, com sessão, role, login, logout, recuperação de acesso; provar envio/recebimento de código antes de liberar testes de usuários. Nunca presumir entrega de e-mail após resposta HTTP.
3. Migrar leitura de auxiliares, restrições, rodízios e histórico; preservar modelos de impressão. Evitar leitura de itens/cabeçalho de snapshots diferentes; verificar revisão pós-leitura ou obter leitura transacional consistente.
4. Conectar a escrita **somente** às sete RPCs versionadas e com revisão original do editor; tratar `P0001`, `42501` e timeout sem repetição cega. Impedir DML direto ou serviço `DELETE` + `INSERT` legado no runtime Neon.
5. Habilitar UI operacional apenas em build/site HML isolado com verificação de host/ambiente; realizar teste de compilação, contract tests e revisão. Produção fica inalterada.

## Responsabilidades e decisões rápidas
| Frente | Responsável executivo | Dependência do usuário |
| --- | --- | --- |
| Código/CI/runbook PR | Agente técnico com revisão Codex | Autorizações de merges e deploy quando forem necessárias |
| Backup Supabase e teste de restauração | Operador com computador autorizado | Disponibilizar computador/acesso sem compartilhar credenciais |
| Homologação de e-mail/2º Admin | Operador da conta de teste + revisor | Acesso aos e-mails e validação de recebimento |
| Mudanças SQL13 e SQL12 na branch descartável | Operador autorizado sob runbook | Autorização específica por intervenção, após snapshot/drenagem |
| Migração experimental de dados/identidades | Operador autorizado | Autorização separada; mapa privado de contas |
| Cutover Neon main, merge e Cloudflare produção | Responsável pelo release e revisor | Aprovação final explícita de cada mudança |

## Indicadores de decisão
- **D23**: contrato/serviços Neon mapeados; backup iniciado; causa do problema de e-mail estabelecida.
- **D24**: backup restaurável comprovado e SQL13 homologada, caso autorizada. Caso contrário, *risco crítico ao prazo*.
- **D25**: SQL12 homologada, sem bypass; interface Neon HML compilando. Caso contrário, *risco crítico ao prazo*.
- **D26**: importação experimental reconciliada e contas Neon funcionais. Caso contrário, *risco crítico ao prazo*.
- **D27**: E2E completo e impressão aprovados; nenhum P0/P1 aberto.
- **D28**: revisão independente, backup/rollback, auditoria de gates e autorização formal.
- **D29**: **GO** apenas com todos os gates satisfeitos; se não, registrar NO-GO com impedimento concreto e não forçar a promoção.

## Gates de liberação obrigatórios
Usar `scripts/check-neon-release-gates.mjs` com provas reais e revisão independente:
`source_inventory`, `restorable_source_backup`, `identity_mapping`, `migration_dry_run_reconciled`, `direct_dml_and_legacy_rpc_closed`, `jwt_two_admins_verified`, `occ_and_locked_history_verified`, `operational_ui_neon_e2e`, `rollback_rehearsed`, `ci_and_review_approved`, `release_authorized`.
**O script comprova completude declarada; não substitui análise técnica.** Não forjar evidências.
A revisão Codex/CI aprovadas do SHA anterior não aprovam qualquer commit posterior; verificar SHA correspondente ao release.

## Restrições desta fase
Esta mudança é apenas documentação na branch GitHub da PR #2. Não executar SQL/DDL/DML, não criar snapshot, não alterar Auth, Neon main, Supabase original, grants, dados, merge ou deploy em produção. As datas são metas condicionadas a gates, e não autorizações.
