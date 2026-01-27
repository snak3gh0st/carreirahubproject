# QuickBooks Customer Sync

## Overview

When a customer is created in the Carreira AI Hub, the system automatically syncs the data to QuickBooks Online.

## Fields Synced to QuickBooks

### Standard Fields

| Hub Field | QuickBooks Field | Notes |
|-----------|------------------|-------|
| `name` | `DisplayName` | Customer display name |
| `email` | `PrimaryEmailAddr.Address` | Primary email (used for invoicing) |
| `phone` | `PrimaryPhone.FreeFormNumber` | Primary phone number |

### Address Fields

| Hub Field | QuickBooks Field | Location |
|-----------|------------------|----------|
| `address` | `BillAddr.Line1` | First line of billing address |
| `city` | `BillAddr.City` | City |
| `state` | `BillAddr.CountrySubDivisionCode` | State code (e.g., "NY", "CA") |
| `zipCode` | `BillAddr.PostalCode` | ZIP/Postal code |
| `country` | `BillAddr.Country` | Country (defaults to "USA") |

### Identification Document Fields

| Hub Field | QuickBooks Storage | Notes |
|-----------|-------------------|-------|
| `ssn` | `Notes` | SSN stored as `SSN: xxx-xx-xxxx` |
| `passport` | `Notes` | Passport stored as `Passport: ABC123456` |
| `cpf` | `Notes` | CPF (Brazil Tax ID) stored as `CPF: 000.000.000-00` |

**Format in QuickBooks Notes:**
- Single ID: `SSN: xxx-xx-xxxx`
- Multiple IDs: `SSN: xxx-xx-xxxx | Passport: ABC123456 | CPF: 000.000.000-00`

**Why Notes field?**  
QuickBooks Online doesn't have dedicated fields for identification documents. Using the Notes field allows storing multiple IDs in a searchable format.

## Sync Behavior

### Create Customer Flow

1. Customer is created in the Hub (via `/api/customers` POST)
2. Identity Mapper reconciles the customer data
3. If customer doesn't have a `quickbooks_id`:
   - System calls `quickbooksService.getOrCreateCustomer()`
   - QuickBooks searches for existing customer by email
   - If found: Links existing QB customer to Hub customer
   - If not found: Creates new customer in QuickBooks with all available data
4. Hub customer record is updated with `quickbooks_id`

### Update Customer Flow

When a customer is updated in the Hub:
- Updates are **NOT** automatically synced to QuickBooks
- Manual sync can be triggered via `/api/quickbooks/sync/customers` endpoint
- This is by design to avoid data conflicts and unnecessary API calls

## QuickBooks API Limitations

### SSN Field
QuickBooks Online does **not** have a dedicated SSN field in the Customer object. Therefore:
- SSN is stored in the `Notes` field with format: `SSN: xxx-xx-xxxx`
- This makes it searchable in QuickBooks but not in a structured field
- Alternative: Use QuickBooks Custom Fields (requires QuickBooks Plus or higher)

### Address Requirements
QuickBooks requires a `BillAddr` (billing address) for customers to:
- Send invoices via email successfully
- Track customer location for tax purposes

If no address data is provided, the system creates a minimal address:
```json
{
  "City": "USA",
  "Country": "USA",
  "Line1": "Billing Address"
}
```

## Integration Logs

All QuickBooks sync operations are logged in the `integration_logs` table:

- **Success**: `service: "quickbooks"`, `action: "customer_created"`, `status: "SUCCESS"`
- **Failure**: `service: "quickbooks"`, `action: "customer_creation_failed"`, `status: "ERROR"`

View logs at: `/dashboard/integration-logs`

## Deduplication

The Identity Mapper prevents duplicate customers:
- **Primary Key**: `email` (unique across Hub and QuickBooks)
- If a customer with the same email exists in QuickBooks, the existing QB customer is linked
- If a customer with the same email exists in the Hub, the existing Hub customer is updated

## Testing

To test QuickBooks customer sync:

```bash
# Run QuickBooks integration test
npm run test:quickbooks
```

This script:
1. Creates a test customer in the Hub
2. Syncs to QuickBooks
3. Verifies the customer exists in both systems
4. Checks that address and SSN data are properly stored

## Manual Sync

To manually sync customers from Hub to QuickBooks:

```bash
# Sync all customers without quickbooks_id
POST /api/quickbooks/sync/customers
```

To sync customers from QuickBooks to Hub:

```bash
# Import all QB customers
POST /api/quickbooks/sync/customers?direction=from-qb
```

## Related Files

- **Service**: `lib/services/quickbooks.service.ts` - `getOrCreateCustomer()`
- **API Route**: `app/api/customers/route.ts` - Customer creation endpoint
- **Identity Mapper**: `lib/services/identity-mapper.ts` - Deduplication logic
- **Schema**: `prisma/schema.prisma` - Customer model definition
