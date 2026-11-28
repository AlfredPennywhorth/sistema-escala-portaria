# Preflight SQL12 e caminho crítico — 27/11/2026

**NO-GO. Somente inventário e preparação. SQL12 não executada.**
Branch de ensaio br-little-hill-b6q7979y, compute ep-sparkling-frog-b6k2wvw7, DB rodizio_portas. O SQL12 original menciona br-holy-term-b6v6ofea; não usar essa instrução como autorização para qualquer branch. Exigir runbook específico e autorização antes de DDL.

## Suspensão da sessão de testes
OTP Gmail expirado; nenhum OTP ativo. Perfil temporário restaurado em transação com lock e pré-condições (1 admin, 1 coordenadora, 1 auxiliar). Fixture 202 revisão 0 e 205 revisão 1. Endpoint desabilitado após inventário. Nenhuma SQL12 aplicada. CORS localhost não é barreira de autorização. Não manter elevação de perfil nem endpoint aberto aguardando e-mail.

## Inventário de funções instalado (somente leitura)
Todas abaixo pertencem a rodizio_portas_owner, SECURITY INVOKER, search_path="", EXECUTE authenticated sim, anonymous não. Presença textual de chamadas usuario_atual_id e usuario_tem_perfil em todas; não confundir presença textual com prova de ordem/semântica.

| RPC | MD5 prosrc |
|---|---|
| atualizar_cabecalho_rascunho_versionado | 08d50c5d2ba87e0ebcd346c24f261548 |
| cancelar_rodizio_versionado | f4438fefdb7b771ba7fe481e8434eee1 |
| criar_rodizio_rascunho_versionado | 0a2d431d7a296fd651976093ab0a585b |
| excluir_rodizio_rascunho_versionado | 613ddf4f568e6ef8901a90df41913b32 |
| publicar_rodizio_versionado | 09b3cc52e175f8dbc1231de824958cf1 |
| substituir_itens_rodizio_rascunho (legada) | 7ce71bcc5bcdc250f0337d0b22167802 |
| substituir_itens_rodizio_rascunho_versionado | f2100180626d8fd8881aebb99ca57d0d |
| travar_rodizio_versionado | 27dd00af004ae6439ffda43f7ea9eae5 |

Ambas tabelas owner esperado, RLS ativa, zero pg_attribute.attacl não nulos em colunas positivas; authenticated possui DML efetivo. Hashes são evidência de drift, não prova de segurança.

## Gates de produção (não aprovados automaticamente)
| Gate | Estado |
|---|---|
| source_inventory | inventário 21/11 disponível; reconfirmar no corte |
| restorable_source_backup | pendente restauração real isolada |
| identity_mapping | pendente resolver vínculo duplicado e mapear três identidades sem copiar senhas |
| migration_dry_run_reconciled | pendente |
| direct_dml_and_legacy_rpc_closed | pendente SQL12 |
| jwt_two_admins_verified | pendente segundo Admin |
| occ_and_locked_history_verified | parcial: seis provas SQL13; concorrência e precedência histórica após SQL12 pendentes |
| operational_ui_neon_e2e | pendente |
| rollback_rehearsed | recuperação baseline conferida; ensaio pós-alteração pendente |
| ci_and_review_approved | cliente 587091ef9b aprovado; reconfirmar SHA de release |
| release_authorized | não autorizado |

## Próxima janela
Não executar SQL12 até completar gate intermediário SQL13, revisar pacote exato, verificar suspensão/drenagem, preparar recuperação da versão atual e obter autorização específica. Reabrir endpoint somente para janela supervisionada; promover Coordenadora novamente apenas quando necessário e autorizado. Testar autenticação antes de armar concorrência. O teste manual OCC com dois clientes não prova sobreposição física sem evidência. Não mudar origem Supabase, HML canônica ou produção.
