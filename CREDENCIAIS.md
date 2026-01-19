# 🔐 Credenciais de Acesso - Carreira AI Hub

## 👥 Usuários Ativos

Todos os usuários usam o domínio **@carreirausa.com**

### 💰 FINANCE
- **Email:** cris@carreirausa.com
- **Senha:** finance123
- **Nome:** cris
- **Acesso:**
  - ✅ Aprovação de invoices
  - ✅ Gestão financeira
  - ✅ Criar invoices (auto-aprovado)
  - ✅ Analytics e relatórios

---

### 💼 COMMERCIAL
- **Email:** comercial@carreirausa.com
- **Senha:** comercial123
- **Nome:** comercial
- **Acesso:**
  - ✅ Criar invoices (precisa aprovação Finance)
  - ✅ Ver próprias invoices
  - ✅ Dashboard comercial

---

## 🚀 Como Fazer Login

1. **Acesse:** http://localhost:3000 ou https://carreirausa.sigmaintel.io
2. Será redirecionado automaticamente para `/auth/signin`
3. Digite o email e senha
4. Após login → Dashboard com saudação personalizada

### Saudação no Dashboard:
- **Manhã (até 12h):** "Bom dia, [Nome]! 👋"
- **Tarde (12h-18h):** "Boa tarde, [Nome]! 👋"
- **Noite (após 18h):** "Boa noite, [Nome]! 👋"

---

## 📝 Comandos de Gerenciamento

### ➕ Criar Novo Usuário
```bash
npm run user:create "<Nome>" <ROLE> <senha>
```

**Exemplo:**
```bash
npm run user:create "Paulo Admin" ADMIN admin123
npm run user:create "Maria Finance" FINANCE finance123
npm run user:create "Carlos Sales" COMMERCIAL sales123
```

**Roles Disponíveis:**
- `ADMIN` - Acesso total
- `FINANCE` - Finanças e aprovações
- `COMMERCIAL` - Comercial (cria invoices)
- `SALES` - Vendas
- `SDR` - Sales Development
- `SUPPORT` - Suporte
- `OPERATIONAL` - Operações

---

### 📋 Listar Todos os Usuários
```bash
npm run user:list
```

**Saída:**
```
📋 Total de Usuários: 2

🏢 FINANCE (1)
────────────────────────────────────────────────────────────
✅ 🔒 cris
   Email: cris@carreirausa.com
   ID: 066acae8-d59e-4a2a-8643-450d308763d7

🏢 COMMERCIAL (1)
────────────────────────────────────────────────────────────
✅ 🔒 comercial
   Email: comercial@carreirausa.com
   ID: b69d8693-413b-467b-8b87-9c4c09286eba

🔒 = Com senha | 🔓 = Sem senha
```

---

### 🔑 Alterar Senha
```bash
npm run user:password <email> <nova-senha>
```

**Exemplo:**
```bash
npm run user:password cris@carreirausa.com novaSenha123
npm run user:password comercial@carreirausa.com novaComercial456
```

---

### ✏️ Atualizar Dados do Usuário
```bash
npm run user:update <email> <campo> <valor>
```

**Campos disponíveis:** `name`, `role`, `active`, `email`

**Exemplos:**
```bash
# Mudar nome
npm run user:update cris@carreirausa.com name "Cristina Finance"

# Mudar role
npm run user:update comercial@carreirausa.com role SALES

# Desativar usuário
npm run user:update comercial@carreirausa.com active false

# Reativar usuário
npm run user:update comercial@carreirausa.com active true

# Mudar email
npm run user:update cris@carreirausa.com email cristina.finance@carreirausa.com
```

---

### ❌ Deletar Usuário
```bash
npm run user:delete <email>
```

**Exemplo:**
```bash
npm run user:delete teste@carreirausa.com
```

---

### 🧪 Testar Login (Debug)
```bash
npm run user:test-login <email> <senha>
```

**Exemplo:**
```bash
npm run user:test-login comercial@carreirausa.com comercial123
```

**Saída:**
```
🔍 Testando login para: comercial@carreirausa.com
   Senha fornecida: comercial123

✅ Usuário encontrado:
   Nome: comercial
   Role: COMMERCIAL
   Ativo: true
   Tem senha: Sim

✅ SENHA CORRETA! Login deve funcionar.
```

---

### ⚠️ Deletar TODOS os Usuários (CUIDADO!)
```bash
npm run user:delete-all
```

**Atenção:**
- Deleta TODOS os usuários do sistema
- Aguarda 3 segundos antes de executar (pode cancelar com Ctrl+C)
- Use com cuidado!

---

## 🔄 Workflow Completo de Invoice

### Cenário: Commercial cria invoice → Finance aprova

#### 1️⃣ Login como COMMERCIAL
```
Email: comercial@carreirausa.com
Senha: comercial123
```

#### 2️⃣ Criar Invoice
```
Dashboard → Commercial → Create Invoice
- Selecionar Customer
- Selecionar Deal
- Selecionar Service Item
- Escolher Price Level (opcional)
- Escolher Payment Terms
- Definir Installments (ex: 3)
- Submit
```

**Resultado:**
```
✅ 3 invoices criadas
   Status: DRAFT
   Approval: PENDING
   Aguardando aprovação Finance
```

#### 3️⃣ Login como FINANCE
```
Email: cris@carreirausa.com
Senha: finance123
```

#### 4️⃣ Aprovar Invoice
```
Dashboard → Finance → Invoices → Approval Queue
- Visualizar invoices pendentes
- Clicar "Review" na primeira
- Clicar "Approve Invoice"
```

**Sistema Executa:**
```
✅ Cria invoice no QuickBooks
✅ Envia email QB para cliente
✅ Registra em IntegrationLog
✅ Atualiza status para SENT/APPROVED
```

#### 5️⃣ Cliente Recebe
```
✅ Email do QuickBooks
✅ PDF da invoice anexo
✅ Link para pagamento online
```

---

## 🔒 Segurança

### Configuração de Senhas
- **Mínimo:** 6 caracteres
- **Hash:** bcrypt (salt rounds: 10)
- **Armazenamento:** Database (campo `password`)
- **Validação:** Obrigatória em todos os logins

### Autenticação
- **Tipo:** NextAuth.js com JWT
- **Provider:** Credentials (email + password)
- **Sessão:** 30 dias
- **Auto-refresh:** A cada 24 horas

### Política de Senhas
```javascript
// Regras atuais:
- Mínimo 6 caracteres
- Case-sensitive
- Sem expiração automática
- Resetável via comando npm run user:password
```

---

## 🐛 Troubleshooting

### ❌ Login não funciona

**Problema:** Email ou senha incorretos

**Solução:**
```bash
# 1. Verificar se usuário existe
npm run user:list

# 2. Testar credenciais
npm run user:test-login email@carreirausa.com senha123

# 3. Se falhar, resetar senha
npm run user:password email@carreirausa.com novaSenha123

# 4. Testar novamente
npm run user:test-login email@carreirausa.com novaSenha123
```

---

### ❌ Usuário não aparece na listagem

**Problema:** Usuário foi deletado ou não foi criado

**Solução:**
```bash
# Criar novamente
npm run user:create "Nome Completo" ROLE senha123
```

---

### ❌ Erro "Password must be at least 6 characters"

**Problema:** Senha muito curta

**Solução:**
```bash
# Use senha com 6+ caracteres
npm run user:create "Nome" ROLE senha123456
```

---

## ✅ Checklist de Verificação

Antes de fazer login:

- [ ] Usuário existe (`npm run user:list`)
- [ ] Usuário está ativo (✅ na listagem)
- [ ] Usuário tem senha (🔒 na listagem)
- [ ] Senha está correta (`npm run user:test-login`)
- [ ] Servidor está rodando (`npm run dev`)
- [ ] URL correta (http://localhost:3000 ou https://carreirausa.sigmaintel.io)

---

## 📞 Suporte

Para problemas com login ou gerenciamento de usuários:

1. **Verificar logs:** Console do servidor mostra erros de autenticação
2. **Testar login:** Use `npm run user:test-login` para debug
3. **Resetar senha:** Use `npm run user:password` se necessário
4. **Criar novo:** Use `npm run user:create` para novo usuário

---

## 🎯 Resumo Rápido

### Comandos Essenciais:
```bash
# Ver todos usuários
npm run user:list

# Criar usuário
npm run user:create "Nome" ROLE senha

# Alterar senha
npm run user:password email@carreirausa.com novaSenha

# Testar login
npm run user:test-login email@carreirausa.com senha

# Deletar usuário
npm run user:delete email@carreirausa.com
```

### Usuários Atuais:
```
Finance:    cris@carreirausa.com / finance123
Commercial: comercial@carreirausa.com / comercial123
```

---

**Última Atualização:** 19/01/2026
**Sistema:** Carreira AI Hub v0.1.0
**Ambiente:** Produção (carreirausa.sigmaintel.io)
