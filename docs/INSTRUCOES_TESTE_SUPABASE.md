# Instruções para Teste no Supabase Real

## ETAPA 9 - Configuração e Testes

---

## 1. Configurar arquivo .env.local

### Opção A: Se você já tem um projeto Supabase

1. Localize as credenciais do seu projeto Supabase:
   - Acesse: https://supabase.com/dashboard
   - Selecione seu projeto
   - Vá em **Settings** → **API**
   - Copie o **Project URL** e **anon/public** key

2. Crie o arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Opção B: Usar projeto de exemplo (para testes)

O arquivo `.env.example` já contém credenciais de exemplo. Você pode copiar para `.env.local`:

```bash
copy .env.example .env.local
```

**ATENÇÃO:** As credenciais de exemplo podem não estar ativas. Recomenda-se criar seu próprio projeto.

---

## 2. Aplicar o Schema no Supabase

### Passo a passo:

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard

2. Selecione seu projeto

3. Vá em **SQL Editor** (ícone de banco de dados no menu lateral)

4. Clique em **New Query**

5. Copie TODO o conteúdo do arquivo `supabase/schema.sql`

6. Cole no editor

7. Clique em **Run** (ou pressione Ctrl+Enter)

8. Verifique se aparece "Success" para cada comando

### O que será criado:

| Tabela | Descrição |
|--------|-----------|
| `auxiliares` | Cadastro de auxiliares |
| `restricoes_auxiliares` | Restrições de disponibilidade |
| `rodizios` | Cabeçalhos de rodízio |
| `rodizio_itens` | Itens de escala |
| `usuarios_auxiliares` | Vínculo usuário-auth ↔ auxiliar |

### O que será configurado:

- Índices para performance
- Funções: `is_admin()`, `is_rodizio_travado()`, `is_coordenadora()`
- Row Level Security (RLS) em todas as tabelas
- Policies de acesso baseadas em perfil
- Triggers de proteção para rodízios travados

---

## 3. Criar o Primeiro Administrador

### Passo 1: Criar usuário no Auth

1. No Supabase Dashboard, vá em **Authentication** → **Users**

2. Clique em **Add User**

3. Preencha:
   - **Email:** seu-email@exemplo.com
   - **Password:** sua-senha-segura
   - Marque **Email confirmed** se necessário

4. Clique em **Create User**

### Passo 2: Obter o User ID

1. Na mesma tela de **Users**, clique no usuário criado

2. Copie o **ID** (UUID grande, ex: `a1b2c3d4-...`)

### Passo 3: Vincular ao perfil admin

1. Vá em **SQL Editor**

2. Execute o seguinte SQL (substitua o ID):

```sql
-- Substitua 'COLE_AQUI_O_USER_ID' pelo ID real do usuário
insert into usuarios_auxiliares (user_id, perfil)
values ('COLE_AQUI_O_USER_ID', 'admin');
```

### Verificar:

```sql
-- Confirme que foi criado corretamente
select * from usuarios_auxiliares;
```

---

## 4. Criar Usuário Auxiliar (Opcional)

### Passo 1: Criar usuário Auth

1. Vá em **Authentication** → **Users** → **Add User**

2. Preencha dados de uma auxiliar

3. Copie o **ID** do usuário

### Passo 2: Primeiro, cadastre a auxiliar

```sql
-- Insira a auxiliar primeiro
insert into auxiliares (nome, email)
values ('Maria da Silva', 'maria@email.com');
```

### Passo 3: Vincule usuário à auxiliar

```sql
-- Substitua os IDs pelos valores reais
insert into usuarios_auxiliares (user_id, auxiliar_id, perfil)
values ('USER_ID_AQUI', 'AUXILIAR_ID_AQUI', 'auxiliar');
```

---

## 5. Testar no Frontend

### Iniciar servidor local:

```bash
npm run dev
```

Acesse: http://localhost:5173

### Testes como Admin:

1. **Login:** Use email/senha do admin criado

2. **AuthStatus:** Verifique se aparece "Administrador" no footer

3. **Auxiliares:** Crie 3 auxiliares de teste via menu "Auxiliares"

4. **Rodízios:** 
   - Crie um novo rodízio
   - Use "Gerar sugestão equilibrada"
   - Salve itens
   - Publique
   - Trave

5. **Verificar bloqueio:** Após travar, confirme que não é possível editar

### Testes como Auxiliar:

1. **Login:** Use email/senha de usuário auxiliar

2. **Área da Auxiliar:** Acesse via menu - deve mostrar escalas

3. **Ações administrativas:** Não deve ver botões de criar/editar rodízios

---

## 6. Verificação de RLS

### Testar como Admin:

```sql
-- Deve retornar dados
select * from auxiliares;
select * from rodizios;
```

### Testar como Auxiliar (via app):

- Deve conseguir ver suas próprias escalas
- Não deve conseguir ver/administrar outras tabelas

---

## 7. Problemas Comuns

### "403 Forbidden" ao acessar dados

**Causa:** Usuário não tem perfil admin no `usuarios_auxiliares`

**Solução:** Verifique se o INSERT foi executado corretamente

### "Row-level security error"

**Causa:** RLS bloqueando operações

**Solução:** Verifique se está logado como admin

### Login não funciona

**Causa:** Credenciais incorretas ou email não confirmado

**Solução:** 
- Verifique email/senha
- Check "Email confirmed" no Supabase

---

## 8. Scripts SQL de Verificação

### Verificar tables criadas:

```sql
select table_name from information_schema.tables 
where table_schema = 'public';
```

### Verificar RLS habilitado:

```sql
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public';
```

### Verificar policies:

```sql
select polname, polcmd from pg_policy;
```

### Verificar triggers:

```sql
select trigger_name, event_manipulation 
from information_schema.triggers 
where trigger_schema = 'public';
```

---

*Documento gerado para Etapa 9 - Teste Completo no Supabase Real*