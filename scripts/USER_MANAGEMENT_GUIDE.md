# User Management Guide

This guide shows how to manage users in the Carreira AI Hub system.

## Quick Reference

All user emails automatically use the **@carreirausa.com** domain.

### Available Roles (Departments)

- **ADMIN** - Full system access
- **FINANCE** - Financial operations, invoice approval
- **COMMERCIAL** - Create invoices (needs approval)
- **SALES** - Create invoices (needs approval)
- **SDR** - Sales Development Representative
- **SUPPORT** - Customer support
- **OPERATIONAL** - Operational tasks

---

## Commands

### 1. Create User

Creates a new user with automatic email generation.

```bash
npm run user:manage create "<Full Name>" <ROLE>
```

**Examples:**
```bash
# Create Finance user
npm run user:manage create "John Finance" FINANCE
# → Email: john.finance@carreirausa.com

# Create Commercial user
npm run user:manage create "Maria Commercial" COMMERCIAL
# → Email: maria.commercial@carreirausa.com

# Create Admin user
npm run user:manage create "Pedro Admin" ADMIN
# → Email: pedro.admin@carreirausa.com
```

**Note:** Name is automatically converted to email:
- "John Doe" → john.doe@carreirausa.com
- "Maria Silva Santos" → maria.silva.santos@carreirausa.com

---

### 2. List Users

Shows all users organized by department.

```bash
npm run user:manage list
```

**Output:**
```
📋 Total Users: 9

🏢 ADMIN (2)
────────────────────────────────────────────────────────────
✅ Admin User
   Email: admin@carreirausa.com
   ID: bd7f2683-04aa-4ec0-b36e-5ebfdf00d471

🏢 FINANCE (2)
────────────────────────────────────────────────────────────
✅ Carlos Finance Manager
   Email: carlos.finance.manager@carreirausa.com
   ID: def61572-c864-4980-9971-a2d7ed8519b9
...
```

---

### 3. Update User

Updates user information (role, name, email, or active status).

```bash
npm run user:manage update <email> <field> <value>
```

**Examples:**

**Change user's role:**
```bash
npm run user:manage update john.finance@carreirausa.com role ADMIN
```

**Change user's name:**
```bash
npm run user:manage update john.finance@carreirausa.com name "John Smith"
```

**Change user's email:**
```bash
npm run user:manage update john.finance@carreirausa.com email john.smith@carreirausa.com
```

**Deactivate user (soft delete):**
```bash
npm run user:manage update john.finance@carreirausa.com active false
```

**Reactivate user:**
```bash
npm run user:manage update john.finance@carreirausa.com active true
```

**Valid fields:** `name`, `role`, `email`, `active`

---

### 4. Delete User

Permanently deletes a user from the system.

```bash
npm run user:manage delete <email>
```

**Example:**
```bash
npm run user:manage delete john.finance@carreirausa.com
```

**Output:**
```
⚠️  About to delete user:
   Email: john.finance@carreirausa.com
   Name: John Finance
   Role: FINANCE
   ID: def61572-c864-4980-9971-a2d7ed8519b9

✅ User deleted successfully!
```

---

## Common Workflows

### Setting Up a New Finance Team Member

```bash
# 1. Create user
npm run user:manage create "Ana Silva" FINANCE

# 2. Verify creation
npm run user:manage list

# 3. User can now login at:
# Email: ana.silva@carreirausa.com
# (Password validation not enforced in development)
```

### Setting Up a New Commercial Team Member

```bash
# 1. Create user
npm run user:manage create "Carlos Sales" COMMERCIAL

# 2. User gets access to:
# - Create Invoice (needs Finance approval)
# - My Invoices (view own invoices)
```

### Promoting a User to Admin

```bash
# Change role from SALES to ADMIN
npm run user:manage update maria.sales@carreirausa.com role ADMIN
```

### Temporarily Deactivating a User

```bash
# Instead of deleting, deactivate
npm run user:manage update john.finance@carreirausa.com active false

# Reactivate later
npm run user:manage update john.finance@carreirausa.com active true
```

---

## Role Permissions

### ADMIN
- Full system access
- All dashboard sections
- Can approve invoices immediately
- Can modify all data

### FINANCE
- Invoice approval
- Payment management
- Customer management
- Analytics and insights
- Can create invoices (auto-approved)

### COMMERCIAL
- Create invoices (needs Finance approval)
- View own invoices
- Limited dashboard access

### SALES
- Create invoices (needs Finance approval)
- Manage deals
- Lead management
- Customer management

### SDR (Sales Development Representative)
- Lead qualification
- Conversation management
- Deal pipeline

### SUPPORT
- Conversation management
- Customer support tasks

### OPERATIONAL
- Operational dashboards
- Customer management
- Deal tracking

---

## Development vs Production

### Development Mode
- Password validation is **not enforced**
- Users can login with any password (or no password)
- Useful for testing different roles

### Production Mode
- Password validation **is enforced**
- Users must set a password via:
  ```bash
  POST /api/auth/set-password
  ```

---

## Tips

1. **Email Format**: The script automatically generates emails from names. Use descriptive names:
   - Good: "John Finance Manager" → john.finance.manager@carreirausa.com
   - Bad: "John" → john@carreirausa.com

2. **Role Selection**: Choose roles carefully based on responsibilities:
   - COMMERCIAL for sales team creating invoices
   - FINANCE for accounting/approval team
   - ADMIN for system administrators

3. **Soft Delete**: Use `active: false` instead of delete for temporary deactivation

4. **Audit Trail**: User IDs are shown in listings for reference in logs

---

## Troubleshooting

### User Already Exists
If you try to create a user with an existing email:
```bash
⚠️  User already exists: john.finance@carreirausa.com
```

Solution: Either use `update` to modify or `delete` then recreate

### Invalid Role
```bash
❌ Invalid role: MANAGER
   Valid roles: ADMIN, FINANCE, SALES, SDR, SUPPORT, OPERATIONAL, COMMERCIAL
```

Solution: Use one of the valid roles listed

### User Not Found
```bash
❌ User not found: nonexistent@carreirausa.com
```

Solution: Check spelling or use `list` to see all users

---

## Getting Help

Run the script without arguments to see usage:
```bash
npm run user:manage
```

This shows all available commands and examples.
