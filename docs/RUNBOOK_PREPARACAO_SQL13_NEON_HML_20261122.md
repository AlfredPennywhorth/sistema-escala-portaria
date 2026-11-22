# Runbook de preparação SQL13 — Neon HML descartável (22/11/2026)

**Status: SOMENTE PREPARAÇÃO DOCUMENTAL — NÃO EXECUTADO.** Este documento não autoriza executar SQL, criar snapshot, modificar permissões, alterar dados, fazer merge ou deploy. A execução da SQL13 exige autorização específica posterior. PR #2 permanece Draft.

## Escopo e identidade imutável do alvo
- Repositório: `AlfredPennywhorth/sistema-escala-portaria`; PR #2; branch GitHub `chore/neon-migration-prep-20261115`.
- HEAD auditado antes da documentação: `5f17302ec9e717d0fa19effa532eeafd89ec5ff3`.
- Neon project ID: `blue-sky-02214231`.
- Branch Neon **somente descartável**: `br-holy-term-b6v6ofea` (nome `hml-rpc-atomic-rollback-20261119`; não é a branch principal/default).
- Database: `rodizio_portas`.
- Compute relacionado à branch, observado na leitura de 22/11: `ep-nameless-dust-b6271958`; host `ep-nameless-dust-b6271958.c-2.sa-east-1.aws.neon.tech`. **Reconfirmar antes da execução.** Não registrar usuário/senha ou string de conexão aqui.
- Neon main `br-lively-lab-b69kz252`, Supabase `pjjrsfnchpizlezrliyw` e Cloudflare produção: **fora de escopo; não tocar**.
- A confirmação do `current_database()` isoladamente **não identifica a branch**: conciliar projeto, branch e endpoint por metadados do Neon e conexão efetiva antes de qualquer passo operacional.

## Evidências existentes e limites (não repetir como prova de execução)
1. CI GitHub Actions run [45022996779](https://github.com/AlfredPennywhorth/sistema-escala-portaria/actions/runs/45022996779) = `completed/success` no SHA `5f17302ec9`; etapa `Validate SQL04 revision-first repair` aprovada (testes *offline*).
2. Codex revisou o mesmo SHA e relatou “Didn't find any major issues” na [PR #2](https://github.com/AlfredPennywhorth/sistema-escala-portaria/pull/2#issuecomment-7079221667). Não equivale a ensaio SQL/ JWT.
3. Leitura anterior, em 22/11, da branch descartável (não repetida nesta atualização documental): `pg_proc.prosrc` da RPC state-first com MD5 `b06899977f63be59f8c993b05d134498`; owner `rodizio_portas_owner`, `plpgsql`, retorno `integer`, volátil, `SECURITY INVOKER`, `search_path=""`. Baseline versionada: `migration/neon/tests/fixtures/sql04_installed_state_first_baseline.sql.txt`.
4. Corpo revision-first proposto em `migration/neon/13_sql04_revision_first_REVIEW_ONLY.sql`, com fingerprint esperado de postflight `f2100180626d8fd8881aebb99ca57d0d`. Não modificar função de origem a partir destes hashes sem repetir o preflight na janela autorizada.
5. Consulta pontual anterior a `pg_stat_activity` não encontrou outras sessões na segunda amostra; **isso não demonstra suspensão de ingressos nem drenagem em uma janela futura**.
6. Consulta de snapshots realizada em 22/11 retornou lista vazia no projeto; **não há snapshot restaurável comprovado**. Não criar, restaurar ou excluir snapshot sob esta autorização.
7. As tabelas `rodizios` e `rodizio_itens` ainda apresentam DML direto efetivo para `authenticated`, e a RPC legada permanece um bypass de OCC conforme auditorias anteriores. **SQL13 não fecha esse P0**. SQL12 só depois de homologar SQL13 e com autorização específica.

## Gate A — preparação e autorização antes de qualquer SQL13
Responsável deve registrar, antes da janela, todos os itens abaixo com data, revisor e evidência. Ausência de qualquer um: **NO-GO**.
- [ ] Autorização **específica** para criação do snapshot, se ainda necessário; snapshot da **branch descartável**, com ID, data/hora, retenção e estratégia de restauração; **validar recuperabilidade** sem tocar main.
- [ ] Autorização **específica e separada** para execução de `migration/neon/13_sql04_revision_first_REVIEW_ONLY.sql`, limitada ao projeto, branch e banco acima.
- [ ] HEAD e revisão Codex/CI do conteúdo a executar reconfirmados; arquivo revisado imutável e fingerprint do artefato de execução registrado.
- [ ] Identificação do endpoint/branch por metadados Neon + conexão; abortar ante qualquer ambiguidade.
- [ ] Inventário de **todos** os ingressos de escrita: tela HML, Data API, RPC legada, RPCs versionadas, clientes antigos, scripts, automações e sessões com privilégios. A suspensão precisa bloquear novas chamadas por todos esses caminhos; ocultar um botão não basta.
- [ ] Suspensão efetiva de **novas** escritas, com responsáveis e horário registrado; manutenção até o encerramento da homologação.
- [ ] Drenagem das transações e requisições já admitidas, com evidência de ausência de escritores/locks relevantes na branch e banco corretos. Uma leitura instantânea sem outras sessões não satisfaz esse gate. Não encerrar sessões sem autorização.
- [ ] Baseline de catálogos, atributos e corpo da RPC compatível com o fingerprint state-first; comparar sem normalização silenciosa.
- [ ] Captura antes/depois da definição e atributos da RPC, das revisões e dos IDs/itens de **fixtures fictícias**. Não utilizar dados reais para testes destrutivos.
- [ ] Plano de rollback ensaiado e responsável designado; distinguir **rollback transacional antes do commit** da **restauração após commit**; não presumir que um simples `ROLLBACK` reverte um commit já confirmado.
- [ ] JWT real de **Admin** no ambiente descartável, perfis negativos de teste, duas sessões distintas e fixtures com estados/revisões controlados; sem inserir credenciais em GitHub.

## Gate B — futura execução somente após Gate A e autorização
1. Manter admissão de escrita suspensa e confirmar novamente projeto/branch/banco/endpoint, drenagem e snapshot.
2. Executar **somente** a SQL13 revisada, em conexão dirigida à branch descartável, com a transação, `lock_timeout`, `statement_timeout`, lock e preflight/postflight do próprio arquivo.
3. Diante de erro, timeout ou drift no preflight/postflight: interromper, verificar estado do commit e aplicar procedimento autorizado de reversão se necessário; nunca repetir automaticamente em caso de resultado de commit incerto.
4. Registrar execução, início/fim, operador, hash do arquivo, estado final da transação, MD5 do corpo instalado e atributos; preservar logs sanitizados.

**Aviso:** as etapas acima são **instruções futuras**, não realizadas por este documento. Não executar SQL12 durante esta janela por encadeamento automático.

## Gate C — futura homologação SQL13 (somente dados fictícios)
| Cenário | Pré-condição essencial | Resultado obrigatório |
| --- | --- | --- |
| JWT Admin, rascunho, revisão atual | Fixture fictícia rascunho não travada, revisão conhecida | Uma substituição válida; revisão sobe **exatamente uma vez**, itens consistentes |
| JWT Admin, revisão obsoleta e estado publicado/travado | Fixture cujo estado **e revisão** mudaram desde a leitura do editor | `P0001` (OCC antes do estado); zero mutações |
| JWT Admin, revisão atual e estado publicado/travado | Revisão atual obtida da fixture já publicada/travada | `42501` pela regra de estado; zero mutações |
| JWT sem perfil Admin | Perfil e fixture com estado/revisão válidos, evitando falso positivo por estado | Recusa de autorização; zero mutações |
| Sem JWT | Fixture e payload válidos | Recusa de autorização; zero mutações |
| Payload inválido ou FK inválida | Fixture de rascunho e revisão atual | Sem DELETE/INSERT parcial; itens e revisão inalterados |
| Concorrência real | Duas sessões Admin independentes usam a **mesma revisão** inicial | Uma gravação confirma; outra `P0001`; integridade e revisão reconciliadas |
| Histórico travado | Registro fictício com revisão correspondente | Recusa; conteúdo histórico intocado |

- Capturar SQLSTATE da resposta real e antes/depois por ID/revisão/contagem/itens; não concluir “aprovado” por mensagem genérica de `42501`, nem executar testes negativos com revisão vencida quando objetivo for validar permissão.
- Se uma chamada terminar em timeout com ACK incerto, **consultar** estado da fixture e revisão antes de qualquer decisão; não repetir a mutação cegamente.
- Confrontar resultado com o arquivo `tests/neon-sql04-revision-order.test.mjs` (prova estática já executada no CI); não reexecutar os testes básicos previamente homologados sem causa objetiva.
- Após SQL13 ainda será **NO-GO do fechamento de escritas** até SQL12 coordenada, testada e autorizada à parte. Nenhuma evidência da SQL13 substitui os gates de DML, RPC legada, JWT e SECURITY DEFINER da SQL12.

## Registro das evidências de homologação (modelo, ainda vazio)
| Campo | Preencher na execução autorizada |
| --- | --- |
| Operador / revisor / autorização específica | PENDENTE |
| Projeto / branch / DB / endpoint reconfirmados | PENDENTE |
| Snapshot ID / recuperabilidade | PENDENTE |
| Ingressos suspensos / início / fim / drenagem | PENDENTE |
| Hash do arquivo SQL13 e baseline pré | PENDENTE |
| Resultado SQL13 / transação / fingerprint pós | PENDENTE |
| Fixture IDs fictícios, JWT/perfis e resultados SQLSTATE | PENDENTE |
| Contagens/revisões antes e depois | PENDENTE |
| Revisão e decisão GO/NO-GO para SQL12 | PENDENTE |

**Estado final desta rodada: NO-GO para SQL13; análise/documentação somente.**

## Referências versionadas
- `migration/neon/13_sql04_revision_first_REVIEW_ONLY.sql`
- `migration/neon/04_optimistic_revision_drafts_PROPOSAL.sql`
- `migration/neon/tests/fixtures/sql04_installed_state_first_baseline.sql.txt`
- `tests/neon-sql04-revision-order.test.mjs`
- `docs/PLANO_FECHAMENTO_ATOMICO_ESCRITAS_NEON_20261122.md`
- `docs/GO_NO_GO_CHECKLIST_20261129.md`
