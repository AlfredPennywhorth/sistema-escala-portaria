# Backup externo da origem Supabase — procedimento para computador (21/11/2026)

**Projeto identificado:** `sistema-escala-portaria`, ref `pjjrsfnchpizlezrliyw`. Este procedimento **não modifica** tabelas ou usuários da origem. Não é necessário executá-lo pelo celular.

## Antes de começar
- Use computador autorizado, espaço privado e pasta **fora do repositório GitHub e de pastas sincronizadas publicamente**. Considere que o dump contém dados pessoais e possivelmente dados de autenticação; proteja com criptografia.
- Instale/verifique Docker Desktop e Supabase CLI. A CLI executa `pg_dump` em contêiner. Consulte a documentação oficial antes de instalar em computador corporativo; não contorne políticas de TI.
- Obtenha a conexão por **Supabase Dashboard > Connect > Session pooler** do projeto exato e a senha do banco, **sem enviar esses segredos pelo chat**. Não redefina a senha só para executar este procedimento sem avaliar impacto sobre conexões do aplicativo.
- Confirme comandos com `supabase --version`, `supabase db dump --help`; os comandos abaixo são exemplos da documentação atual e não foram executados nesta sessão.

## Exportação manual recomendada (PowerShell)

Abra PowerShell no diretório privado escolhido (por exemplo, um volume criptografado). Defina a conexão somente nessa sessão, lendo o valor sem exibir na tela (observe que a CLI pode passar parâmetros internamente ao processo):
```powershell
$Secure = Read-Host "URL de conexão Supabase (inclui senha)" -AsSecureString
$DbUrl = [System.Net.NetworkCredential]::new('', $Secure).Password
supabase db dump --db-url "$DbUrl" -f roles.sql --role-only
supabase db dump --db-url "$DbUrl" -f schema.sql
supabase db dump --db-url "$DbUrl" -f data.sql --use-copy --data-only
Remove-Variable DbUrl, Secure
```
**Atenção:** passar a URL na linha de comando pode expô-la temporariamente a mecanismos locais de inspeção de processos. Execute apenas em máquina confiável e não grave a conexão em arquivos, terminal compartilhado, histórico ou repositório. Como alternativa, usar uma credencial de curta duração, se a infraestrutura permitir.

Após exportar, confira se os três arquivos existem e não estão vazios. Gere hashes locais:
```powershell
Get-Item .\roles.sql, .\schema.sql, .\data.sql | Select-Object Name, Length
Get-FileHash .\roles.sql, .\schema.sql, .\data.sql -Algorithm SHA256 | Select-Object Path, Hash
```
Armazene arquivo e hash em local privado criptografado. **Não enviar os dumps para esta conversa, PR pública ou e-mail aberto.**

## Escopo e limitações
- Os três comandos usam a estratégia de dump lógico descrita pela Supabase; o CLI **exclui schemas gerenciados** (p. ex. `auth` e `storage`) no dump padrão. Portanto estes arquivos **não bastam para assegurar portabilidade do Supabase Auth**. Migrar identidades/credenciais para Neon Auth depende de plano próprio, exportação apropriada e reteste de login. Não copiar senhas-hash/dados de `auth.users` diretamente para Neon Auth.
- Dados reais no inventário da origem em 21/11: 9 auxiliares, 8 rodízios, 380 itens, 8 restrições e 4 vínculos (3 identidades Auth, sendo uma com vínculo duplicado).
- Preservar os 8 itens de 04/07/2026 vinculados ao rodízio travado iniciado 05/07/2026; não tentar corrigir dados de origem automaticamente.
- Para testar restauração, utilizar **PostgreSQL isolado preparado**, com scripts verificados, extensões, privilégios e compatibilidade. **Nunca testar restauração na própria origem, no Neon main, na HML principal ou na produção.**
- Um backup somente poderá ser dado como **restaurável** após restauração isolada, comparação de dados/esquema e integridade. A presença de `roles.sql`, `schema.sql` e `data.sql` **não fecha sozinha** o gate Go/No-Go.
- Supabase Storage (objetos), Edge Functions, configurações Auth/SMTP, tokens e secrets não são cobertos inteiramente pelo dump lógico e precisam de inventário independente, se usados pelo sistema.

## Referências oficiais
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/self-hosting/restore-from-platform

## Quando o computador estiver disponível
Retomar a partir da verificação de `supabase --version` e de `Docker Desktop`. Acompanhar os três arquivos, seus tamanhos/hashes e um teste de restauração isolado. Registrar **somente metadados não sensíveis** na PR #2. Nenhum backup foi criado nesta sessão.
