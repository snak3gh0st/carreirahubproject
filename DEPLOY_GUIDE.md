# 🚀 Deploy Guide - Carreira AI Hub

## ✅ Pre-Deploy Checklist

- [x] Build passes locally (`npm run build`)
- [x] Database schema updated
- [x] Data migration completed (document → ssn)
- [x] Dependencies installed (`next-themes`)
- [x] ESLint configured
- [x] All changes committed

## 🔧 Latest Changes (Ready for Deploy)

### Features Added
1. **SSN Field** - Replaced `document` (CPF/CNPJ) with `ssn` (Social Security Number)
2. **Address Fields** - Added full US address support:
   - `address` - Street address
   - `city` - City
   - `state` - State code (2 letters)
   - `zipCode` - ZIP code
   - `country` - Country (default: USA)
3. **QuickBooks Sync** - All customer data syncs to QuickBooks:
   - SSN stored in Notes field
   - Address stored in BillAddr fields

### Files Modified
- `prisma/schema.prisma` - Database schema
- `app/dashboard/customers/new/CustomerForm.tsx` - Form UI
- `app/api/customers/route.ts` - Customer API
- `lib/services/quickbooks.service.ts` - QB integration
- `lib/services/identity-mapper.ts` - Customer reconciliation

### Migration Completed
✅ 3 customers migrated from `document` to `ssn`

## 📦 Deploy Options

### Option 1: Vercel CLI (Quickest)

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Option 2: Git + Vercel Integration

1. **Setup Git Remote** (if not configured):
   ```bash
   git remote add origin <YOUR_REPO_URL>
   git push -u origin master
   ```

2. **Connect to Vercel**:
   - Go to https://vercel.com/dashboard
   - Click "Add New... > Project"
   - Import your Git repository
   - Configure environment variables (see below)
   - Click "Deploy"

### Option 3: Vercel Dashboard (Manual Upload)

1. Go to https://vercel.com/dashboard
2. Click "Add New... > Project"
3. Choose "Deploy from template" or "Import Git Repository"
4. Upload project or connect repo
5. Configure environment variables
6. Deploy

## 🔐 Environment Variables

### Required Variables (Copy from .env.local)

```bash
# Database
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Redis
REDIS_URL=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-domain.vercel.app

# OpenAI
OPENAI_API_KEY=
AI_MODEL=gpt-4-turbo-preview
AI_TEMPERATURE=0.7

# QuickBooks
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=https://your-domain.vercel.app/api/quickbooks/auth/callback
QUICKBOOKS_ENVIRONMENT=production

# Stripe
STRIPE_SECRET_KEY=

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=

# DocuSign
DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_RSA_PRIVATE_KEY=

# Pipedrive
PIPEDRIVE_API_TOKEN=
PIPEDRIVE_WEBHOOK_SECRET=

# SDR Config
SDR_QUALIFICATION_THRESHOLD=70
```

## 🗄️ Database Migration

The database migration has already been run locally:
- ✅ Schema updated (new fields added)
- ✅ Data migrated (document → ssn)
- ✅ Old column dropped

**Vercel will automatically**:
- Generate Prisma Client during build
- Connect to your Neon database
- Schema is already up-to-date

**No manual migration needed on Vercel!**

## ✅ Post-Deploy Verification

### 1. Check Build Logs
- Go to Vercel Dashboard
- Click on your deployment
- Check "Building" tab for any errors

### 2. Test Customer Creation
```bash
# Navigate to your app
https://your-domain.vercel.app/dashboard/customers/new

# Create a test customer with:
- Name: John Doe
- Email: test@example.com
- Phone: +1 (555) 123-4567
- SSN: 123-45-6789
- Address: 123 Main St
- City: New York
- State: NY
- ZIP: 10001
```

### 3. Verify QuickBooks Sync
- Customer should be created in QuickBooks
- Check QuickBooks for:
  - Customer name and email
  - Billing address
  - Notes field (should contain SSN)

### 4. Check Integration Logs
```bash
https://your-domain.vercel.app/dashboard/integration-logs
```
Look for:
- ✅ `service: "quickbooks"`, `status: "SUCCESS"`

## 🐛 Common Issues

### Build Fails

**Issue**: "Cannot find module 'next-themes'"
**Solution**: Already fixed - dependency installed

**Issue**: "Property 'ssn' does not exist"
**Solution**: Already fixed - Prisma Client regenerated

### Runtime Issues

**Issue**: QuickBooks OAuth not working
**Solution**: Update `QUICKBOOKS_REDIRECT_URI` in both:
1. Vercel environment variables
2. QuickBooks App settings (Intuit Developer Portal)

**Issue**: Database connection fails
**Solution**: Check `POSTGRES_PRISMA_URL` in Vercel env vars

### SSN Not Showing in QuickBooks

**Issue**: SSN not visible in customer
**Solution**: SSN is in the "Notes" field, not a dedicated field

## 📊 Monitoring

### Logs
```bash
# Real-time logs
vercel logs --follow

# Recent logs
vercel logs
```

### Analytics
- Dashboard: https://vercel.com/dashboard
- Performance: Vercel Analytics
- Errors: Vercel Error Tracking

## 🔄 Rollback

If something goes wrong:

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
```

## 📞 Support

**Build Issues**: Check `.next/trace` file in Vercel logs
**Runtime Issues**: Check Vercel Function logs
**Database Issues**: Check Neon database logs

---

## 🎉 Ready to Deploy!

All changes are committed and tested. The build passes locally. You're ready to deploy to Vercel!

**Choose your deploy method above and go! 🚀**
