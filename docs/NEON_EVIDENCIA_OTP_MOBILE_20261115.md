# Evidência de homologação — Autenticação por OTP (15/11/2026)

Ambiente HTTPS Cloudflare Pages: `https://rodizio-portaria-neon-hml.pages.dev/`
Neon Auth: branch isolada `br-late-night-b6pydxvn`; a aplicação principal permanece inalterada.

## Caso AUT-01 — Código por e-mail e sessão mobile
**Resultado: APROVADO para autenticação OTP.**

Evidência: captura de tela enviada pelo responsável pela homologação em 15/11/2026, mostrando:
- Mensagem de interface: «Código aceito pelo provedor. Verifique sua sessão e seu perfil.»
- Resultado de `verificarNeonPilot()`: `autenticado: true`, `usuario: Identidade verificada`, `perfil: Sem vínculo`.
- Consulta adicional read-only à branch Neon: `neon_auth."user"."emailVerified" = true`, vínculo `usuarios_auxiliares` = 0 para a identidade de teste.

**Alcance:** login por código recebido no celular; consulta à sessão e ausência de perfil administrativo. Não equivale a comprovar leitura RLS positiva, revogação de sessão, recuperação de senha, magic link ou login por senha.

## Casos seguintes (não aprovados ainda)
- AUT-02: sem vínculo, clicar em «Testar acesso às escalas»: resultado esperado **zero registros**, sem exposição de dados sintéticos (a resposta «Consulta permitida: 0 escala(s)» precisa ser interpretada como operação de leitura sob RLS, não permissão de perfil). Registrar mensagem exata.
- AUT-03: clicar em «Encerrar sessão», depois «Verificar sessão e perfil»: deve indicar «Sessão autenticada obrigatória».
- AUT-04: tentar «Testar acesso às escalas» sem sessão: precisa ser negado ou não retornar registros, conforme política configurada; verificar também código HTTP quando houver acesso a logs.
- AUT-05: testar sessões reais e autorização de quatro perfis, com permissões positivas e negativas.
- AUT-06: login por senha, recuperação, expiração e revogação.

Não registrar código OTP, senha, token JWT, conteúdo do e-mail, nem capturas com informações privadas no GitHub.

## Gates
Sem merge na `master`, sem publicação de produção; PR #2 permanece draft.
