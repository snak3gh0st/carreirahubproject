# 🔐 Credenciais de Acesso - Carreira AI Hub

## 👥 Usuários Criados

Todos os usuários foram criados com senha e usam o domínio **@carreirausa.com**

### 🔑 ADMIN
- **Email:** paulo.admin@carreirausa.com
- **Senha:** admin123
- **Nome:** Paulo Admin
- **Acesso:** Total do sistema

---

### 💰 FINANCE
- **Email:** maria.finance@carreirausa.com
- **Senha:** finance123
- **Nome:** Maria Finance
- **Acesso:**
  - Aprovação de invoices
  - Gestão financeira
  - Criar invoices (auto-aprovado)
  - Analytics e relatórios

---

### 💼 COMMERCIAL
- **Email:** carlos.commercial@carreirausa.com
- **Senha:** comercial123
- **Nome:** Carlos Commercial
- **Acesso:**
  - Criar invoices (precisa aprovação Finance)
  - Ver próprias invoices
  - Dashboard limitado

---

### 📊 SALES
- **Email:** ana.sales@carreirausa.com
- **Senha:** sales123
- **Nome:** Ana Sales
- **Acesso:**
  - Criar invoices (precisa aprovação Finance)
  - Gestão de deals
  - Gestão de leads
  - Customers

---

### 🎯 SDR (Sales Development Representative)
- **Email:** joo.sdr@carreirausa.com
- **Senha:** sdr123
- **Nome:** João SDR
- **Acesso:**
  - Qualificação de leads
  - Gestão de conversas
  - Pipeline de vendas

---

### 💬 SUPPORT
- **Email:** beatriz.support@carreirausa.com
- **Senha:** support123
- **Nome:** Beatriz Support
- **Acesso:**
  - Gestão de conversas
  - Atendimento ao cliente
  - Suporte

---

### ⚙️ OPERATIONAL
- **Email:** ricardo.operations@carreirausa.com
- **Senha:** operations123
- **Nome:** Ricardo Operations
- **Acesso:**
  - Dashboards operacionais
  - Gestão de customers
  - Tracking de deals

---

## 🚀 Como Fazer Login

1. Acesse: http://localhost:3000
2. Você será redirecionado automaticamente para a página de login
3. Digite o email e senha do usuário desejado
4. Após login, será redirecionado para o Dashboard com saudação personalizada

### Exemplo de Saudação no Dashboard:
- **Manhã (até 12h):** "Bom dia, Paulo! 👋"
- **Tarde (12h-18h):** "Boa tarde, Paulo! 👋"
- **Noite (após 18h):** "Boa noite, Paulo! 👋"

---

## 📝 Comandos de Gerenciamento de Usuários

### Criar Novo Usuário
```bash
npm run user:create-secure "<Nome Completo>" <ROLE> <senha>
```

**Exemplo:**
```bash
npm run user:create-secure "Pedro Silva" FINANCE pedro123
```

**Roles Disponíveis:** ADMIN, FINANCE, COMMERCIAL, SALES, SDR, SUPPORT, OPERATIONAL

---

### Listar Todos os Usuários
```bash
npm run user:list
```

Mostra todos os usuários organizados por departamento com indicador de senha (🔒 = com senha)

---

### Alterar Senha de Usuário
```bash
npm run user:password <email> <nova-senha>
```

**Exemplo:**
```bash
npm run user:password paulo.admin@carreirausa.com novaSenha456
```

---

### Atualizar Informações do Usuário
```bash
npm run user:update <email> <campo> <valor>
```

**Campos válidos:** name, role, active, email

**Exemplos:**
```bash
# Mudar nome
npm run user:update paulo.admin@carreirausa.com name "Paulo Loureiro"

# Mudar role
npm run user:update maria.finance@carreirausa.com role ADMIN

# Desativar usuário
npm run user:update carlos.commercial@carreirausa.com active false
```

---

### Deletar Usuário
```bash
npm run user:delete <email>
```

**Exemplo:**
```bash
npm run user:delete teste@carreirausa.com
```

---

### Deletar TODOS os Usuários (⚠️ CUIDADO!)
```bash
npm run user:delete-all
```

**Atenção:** Este comando deleta TODOS os usuários do sistema após 3 segundos de espera.

---

## 🔄 Workflow de Invoice com Senha

### 1. Usuário COMMERCIAL cria invoice:
```
Login: carlos.commercial@carreirausa.com / comercial123
Dashboard → Commercial → Create Invoice
Status: DRAFT
Approval: PENDING
```

### 2. Usuário FINANCE aprova:
```
Login: maria.finance@carreirausa.com / finance123
Dashboard → Finance → Invoices → Approval Queue
Clica em "Approve"
Sistema:
  ✓ Cria invoice no QuickBooks
  ✓ Envia email QB para cliente
  ✓ Registra em IntegrationLog
```

### 3. Cliente recebe:
```
✓ Email do QuickBooks
✓ PDF da invoice
✓ Link para pagamento
```

---

## 🔒 Segurança

### Senhas
- **Mínimo:** 6 caracteres
- **Hash:** bcrypt (salt rounds: 10)
- **Armazenamento:** Database (campo `password`)
- **Validação:** Obrigatória no login

### Sessão
- **Tipo:** JWT
- **Duração:** 30 dias
- **Atualização:** A cada 24 horas
- **Secret:** NEXTAUTH_SECRET (env variable)

### Desenvolvimento vs Produção
- **Desenvolvimento:** Senhas definidas manualmente via script
- **Produção:** Usuários devem definir senha no primeiro acesso

---

## 📞 Suporte

Para criar novos usuários ou resetar senhas, use os comandos acima ou entre em contato com o administrador do sistema.

**Email do Admin:** paulo.admin@carreirausa.com

---

## ✅ Checklist de Verificação

- [x] Todos os usuários criados com senha
- [x] Autenticação obrigatória
- [x] Página inicial redireciona para dashboard ou login
- [x] Dashboard mostra saudação personalizada (Bom dia + nome)
- [x] Sistema de roles funcionando
- [x] Approval workflow ativo
- [x] QuickBooks integration pronta
- [x] Scripts de gerenciamento de usuários funcionais

---

**Última Atualização:** 19/01/2026
**Versão do Sistema:** 0.1.0
