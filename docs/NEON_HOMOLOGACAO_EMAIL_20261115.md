# Homologação de e-mail Neon Auth — 15/11/2026

## Conta de teste criada
- Ambiente: projeto `rodizio-auxiliares-portas`, branch Neon `homologacao-auth-rls-20261115`.
- Identificador Neon Auth: `97561149-24ed-421a-ae19-5ef2848ccfcd`.
- Caixa postal controlada: e-mail informado pelo proprietário do projeto (não publicar e-mail em relatórios ou fixtures).
- `neon_auth."user"."emailVerified"`: `false` após provisionamento.
- `public.usuarios_auxiliares`: **zero vínculos**; nenhum papel `admin` concedido.
- Neon Data API da branch: `active` usando `neon_auth`.

## Entrega e limitações
- A criação administrativa de uma conta no Neon Auth **não comprova** login por senha, magic link, envio/recebimento de e-mail nem criação de sessão.
- Tentativa de disparar um teste pelo recurso `send_auth_test_email`: **não executada pelo provedor** com erro `INVALID_EMAIL_PROVIDER_TYPE` — provedor compartilhado de e-mails não suporta este teste. Não interpretar como teste negativo do fluxo de magic link.
- Nenhum e-mail de autenticação real foi confirmado como enviado.
- O domínio de homologação externo ainda precisa ser publicado e incluído nas trusted origins para validar login pelo celular.
- Não associar usuário a perfil administrativo antes de testar o caso de conta sem vínculo.
- Não colocar e-mails de pessoas reais, senhas, tokens nem códigos OTP em arquivos GitHub; guardar apenas identificadores de ambiente e evidências não sensíveis.

## Próxima sequência
1. Publicar a tela isolada em domínio HTTPS exclusivo, sem modificar a aplicação existente.
2. Cadastrar somente o domínio isolado nas trusted origins do Neon Auth da branch de homologação.
3. Enviar link/código de autenticação pelo **fluxo do próprio aplicativo**, nunca por edição manual de credenciais.
4. Confirmar e-mail, iniciar sessão e testar acesso negado para conta sem vínculo.
5. Vincular temporariamente essa conta a cada perfil de teste, de maneira administrativamente controlada, com reconexão de sessão entre trocas; conferir permissões e registrar resultados. Contas separadas são preferíveis para testes concorrentes.
6. Testar histórico travado, logout e recuperação de senha; só então avaliar habilitar o runtime Neon em homologação.

Sem merge, sem deploy em produção e sem reativar Supabase.
