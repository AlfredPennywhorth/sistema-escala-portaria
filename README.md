# Sistema de Escala de Portaria — Rodízio das Auxiliares das Portas

Sistema web de organização do rodízio das auxiliares das portas, contemplando cadastro de auxiliares, restrições, elaboração e acompanhamento de escalas/rodízios, consulta pela auxiliar, histórico e impressão.

> **Memorial de continuidade — 23/11/2026.** A aplicação operacional vigente continua usando **Supabase**. Está em andamento uma migração controlada para **Neon PostgreSQL + Neon Auth**, desenvolvida e homologada de forma isolada na [PR #2](https://github.com/AlfredPennywhorth/sistema-escala-portaria/pull/2). **A PR está em Draft; não fazer merge, alterar a produção nem migrar dados reais sem autorização explícita e gates cumpridos.** A data-alvo de 29/11/2026 é uma meta, não uma autorização de corte.

## 1. Projeto, arquitetura e ambientes

- **Repositório:** `AlfredPennywhorth/sistema-escala-portaria`.
- **Stack web:** React 19, TypeScript, Vite 8, Tailwind CSS 4; autenticação e acesso a dados atualmente via `@supabase/supabase-js` no fluxo principal; piloto Neon via `@neondatabase/neon-js` 0.9.0-beta.
- **Origem em uso:** Supabase, projeto `pjjrsfnchpizlezrliyw`. O fluxo principal de `src/App.tsx` continua Supabase quando a flag de homologação Neon não está ativada.
- **Destino planejado:** Neon, projeto `blue-sky-02214231`, banco `rodizio_portas`. A branch principal Neon **não** é alvo de experimentos.
- **Homologação isolada:** Cloudflare Pages em [rodizio-portaria-neon-hml.pages.dev](https://rodizio-portaria-neon-hml.pages.dev/), com build `npm run build:cloudflare-homologacao`. O diagnóstico de Auth abre na página-base; a prévia operacional **somente leitura** usa `?operacional-neon=1` e exige perfil Admin. Preview e HML **não** são produção.
- **Branches Neon descartáveis verificadas:** `br-late-night-b6pydxvn` (Auth/HML) e `br-holy-term-b6v6ofea` (testes SQL/RPC). A configuração do build e as URLs de endpoints, não apenas o nome da branch, precisam ser reconciliadas ao investigar divergências.
- **Branch Git da migração:** `chore/neon-migration-prep-20261115`; base da PR: `master`.

Não incorporar credenciais de banco, URLs com senha, JWTs, OTPs, dumps de usuários ou informações pessoais ao repositório. Ver [guia Cloudflare HML](docs/CLOUDFLARE_PAGES_HOMOLOGACAO_20261115.md); algumas instruções daquele guia documentam o estado inicial de 15/11 e devem ser confrontadas com este memorial.

## 2. Situação verificada em 23/11/2026

| Eixo | Evidência | Estado |
| --- | --- | --- |
| PR #2 | Aberta, **Draft**, sem merge | Ambiente isolado |
| Último commit com CI e Codex confirmados nesta atualização | `386b82f62ee1`; GitHub Actions `45250241498` **success**; Codex sem achados importantes no mesmo SHA | Revisão técnica aprovada **para esse commit**, não para produção |
| OTP por dados móveis (5G) | Código chegou imediatamente e foi aceito pelo Neon Auth; sessão autenticada e identidade confirmada | **Autenticação pontual aprovada** |
| Diagnóstico de vínculo no celular | E-mail informado corresponde ao Auth; IDs da sessão e Auth coincidem; SELECT de `usuarios_auxiliares` retorna sem erro e **sem vínculo visível** | **Divergência aberta** |
| Cadastro lido diretamente no Neon HML | A identidade da conta testada tem um vínculo de perfil **`coordenadora`** nas duas branches verificadas | Registro físico existe; não equivale a visibilidade por JWT/RLS |
| Contas de teste adicionais | Contas verificadas nas duas branches com perfis distintos **`auxiliar`** e **`admin`** | Login e permissões E2E ainda precisam ser homologados; não promover papéis automaticamente |
| Investigação JWT PostgreSQL | A função existente `usuario_atual_id()` usa `auth.uid()`; diagnóstico novo compara identidade SQL/Auth **sem exibir UUID/JWT** | Implementado em PR; **execução funcional da versão nova ainda pendente** |
| Prévia operacional | Interface React isolada em modo leitura, inclusive preparação de rascunho em memória | **Não** representa migração operacional E2E |
| Dados reais e backup | Inventário da origem confirmado; backup/restauração isolada ainda não comprovados | **Gate bloqueado** |
| Produção | Runtime original Supabase | **Sem alterações decorrentes da PR #2** |

**Interpretação do defeito atual:** o login Auth não comprova que a Data API recebeu o mesmo JWT ou consultou a mesma branch. A ausência de linha numa consulta sujeita à RLS não prova ausência física de registro. As hipóteses ainda abertas são contexto JWT/PostgreSQL, autorização RLS ou ambiente/endpoints divergentes. **Não** criar um segundo vínculo, alterar papel nem afrouxar policy para mascarar a falha.

### Histórico da investigação de 23/11

1. O primeiro OTP da manhã foi visto tardiamente e expirou; não foi possível determinar se a causa foi rede, sincronização do Gmail ou transporte de e-mail.
2. Uma nova tentativa por **5G** recebeu OTP imediatamente e autenticou a sessão. Foi observado `autenticado: true` e `perfil: "Sem vínculo"`.
3. Consulta administrativa **somente leitura** às branches HML confirmou vínculo físico do e-mail de teste com perfil `coordenadora`.
4. O diagnóstico JWT/RLS na interface confirmou identidade de sessão/Auth e igualdade do e-mail informado, mas retornou `vinculoVisivelPelaRls: false`, `consultaSemErro: true`.
5. O Codex apontou uma corrida de troca de sessão; corrigida, com revalidação da identidade antes de publicar resultado. Outro build falhou por tipagem `TS7006`; corrigida.
6. Foi acrescentada leitura da RPC **já existente** `usuario_atual_id` para diferenciar JWT SQL ausente, divergente ou coincidente. Dois P2 subsequentes do Codex foram corrigidos: contrato de teste permite **apenas essa RPC**; indicadores JWT não são perdidos quando há erro RLS após reconfirmação da sessão.
7. O **HEAD `386b82f62ee1`** passou no CI `45250241498` e recebeu revisão Codex sem problemas importantes. **Ainda não há evidência nesta atualização de deploy Cloudflare desse SHA nem de execução do diagnóstico SQL novo no celular.**

Arquivos pertinentes:
- `src/components/NeonAuthHomologacao.tsx` — tela de autenticação e botão do diagnóstico.
- `src/services/neon/authVinculoDiagnosticHmlService.ts` — indicadores de sessão, e-mail, RLS e JWT PostgreSQL; sem exposição de identidade.
- `src/services/neonPilotService.ts` — consulta do vínculo e leituras piloto.
- `src/lib/neon.ts` — instância do cliente Neon Auth/Data API.
- `tests/neon-contracts.test.mjs` — contratos estáticos de autorização, concorrência, read-only e RPC permitida.

## 3. Inventário real da origem e integridade

Inventário **somente leitura** da origem Supabase, apurado em 21/11/2026:

| Entidade | Quantidade |
| --- | ---: |
| Auxiliares | 9 |
| Rodízios | 8 (7 travados) |
| Itens de rodízio | 380 |
| Restrições | 8 |
| Vínculos de usuários | 4, associados a 3 identidades |
| Objetos Storage / Edge Functions identificadas | 0 / 0 |

A origem possui **8 itens históricos de 04/07/2026** pertencentes a rodízio travado iniciado em **05/07/2026**. Preservar esse histórico: não corrigir automaticamente datas ou excluir registros. Há vínculo duplicado de uma identidade a reconciliar antes de aplicar unicidade/FK no destino. Contagens da origem **não** demonstram que os dados reais já estejam no Neon.

O backup restaurável **não foi comprovado**. Orientações para exportação protegida e validação offline: [Backup da origem no computador](docs/BACKUP_ORIGEM_SUPABASE_NO_COMPUTADOR_20261121.md). O script `scripts/check-supabase-backup-files.mjs` verifica integridade básica e hashes dos três dumps, mas **não certifica restauração**. Nunca versionar os dumps.

## 4. Caminho crítico e gates — meta 29/11/2026

1. **Diagnóstico atual:** confirmar que o deploy HML contém `386b82f62ee1`; executar o diagnóstico seguro via sessão JWT, inspecionando `jwtPostgresDisponivel` e `jwtPostgresCoincideComAuth`. Corrigir a causa comprovada com review/CI, sem mudar banco por iniciativa própria.
2. **Auth e RLS:** reconciliar contas, branches e endpoints; validar dois Administradores distintos e acesso/negação de Auxiliar, renovação e encerramento de sessão, sem confundir `coordenadora` com `admin`.
3. **Fechar desvios de segurança:** revisar SQL12/SQL13 em modo `REVIEW_ONLY`, acesso por DML direto, RPC legada, OCC/revisão e histórico travado; obter autorização específica antes de executar qualquer SQL/grant ou alterar papéis.
4. **Funcional E2E Neon:** autenticação, cadastro, restrições, criação/edição de rascunho, geração de itens, publicação/travamento, consulta de auxiliares, impressão e falhas controladas. A prévia atual em leitura não satisfaz esse gate.
5. **Proteção da origem:** produzir backup externo autorizado e comprovar restauração **em banco isolado**, integridade, hashes e plano de reversão; reconciliar mapeamento das 3 identidades e os dados históricos.
6. **Migração ensaiada:** executar somente com autorização específica em ambiente isolado, reconciliar contagens/FKs/itens e testar rollback. Não executar cópia real sobre Neon main sem gate.
7. **Go/No-Go:** reunir evidências, revisor e autorização formal. **Somente com GO explícito** discutir merge/cutover, deploy e alteração da produção.

Gates do `scripts/check-neon-release-gates.mjs`: `source_inventory`, `restorable_source_backup`, `identity_mapping`, `migration_dry_run_reconciled`, `direct_dml_and_legacy_rpc_closed`, `jwt_two_admins_verified`, `occ_and_locked_history_verified`, `operational_ui_neon_e2e`, `rollback_rehearsed`, `ci_and_review_approved`, `release_authorized`. Ver [checklist de Go/No-Go](docs/GO_NO_GO_CHECKLIST_20261129.md), cujo cronograma original representa metas, não evidências já concluídas.

**Estado de liberação em 23/11: NO-GO.** CI verde e Codex aprovado são necessários, mas insuficientes. Não presumir migração concluída, backup válido, segundo Admin homologado ou autorização de release.

## 5. Operação de desenvolvimento — somente tarefas autorizadas

```bash
npm ci
npm run lint
npm run build
node --test tests/neon-contracts.test.mjs
```

A compilação Cloudflare HML tem bloqueios próprios de branch/ambiente: `npm run build:cloudflare-homologacao` é destinada à infraestrutura Cloudflare configurada, não à produção principal. O CI da PR inclui verificações estáticas e builds sem credenciais de produção.

**Regras permanentes:**
- `Prossiga` ou autorização genérica de continuidade permitem análise, documentação, testes offline e commits seguros **apenas na PR #2 Draft**, não mutações de dados ou liberação.
- Proibidos sem autorização explícita separada: SQL12/SQL13, DDL/DML/grants/RLS, alterações em Neon main/Supabase real, promoção de usuários, backup/restore ou migração com dados reais, merge e deploy de produção.
- Preferir diagnósticos em leitura, evidência por SHA, revisão Codex e CI verde antes de solicitar novos testes manuais. Nunca divulgar OTP, JWT, UUID privado, senhas ou dados reais em logs/PR.
- Não afirmar que um commit revisado já foi publicado no Cloudflare sem verificar a implantação do **mesmo SHA**.

## 6. Documentação e continuidade

- [PR #2 — migração isolada](https://github.com/AlfredPennywhorth/sistema-escala-portaria/pull/2).
- [Go/No-Go — meta 29/11/2026](docs/GO_NO_GO_CHECKLIST_20261129.md).
- [Diagnóstico Neon Auth por e-mail](docs/DIAGNOSTICO_EMAIL_NEON_AUTH_HML_20261122.md) — contém histórico anterior à autenticação bem-sucedida; a atualização de estado mais recente está neste README.
- [Backup de origem Supabase no computador](docs/BACKUP_ORIGEM_SUPABASE_NO_COMPUTADOR_20261121.md).
- [Cloudflare Pages — homologação](docs/CLOUDFLARE_PAGES_HOMOLOGACAO_20261115.md).
- [Plano de melhorias preexistente](PLANO_DE_MELHORIAS.md).

**Ponto exato de retomada:** validar o deploy HML do HEAD `386b82f62ee1`, executar diagnóstico SQL/Auth/RLS somente leitura, interpretar indicadores sem suposições, registrar evidência anonimizada e resolver a invisibilidade do vínculo antes de seguir para permissões e o fluxo operacional. A governança de produção continua **NO-GO**.
