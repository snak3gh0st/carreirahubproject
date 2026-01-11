# QuickBooks OAuth Token Refresh

## Overview

QuickBooks OAuth access tokens expire every ~60 days. This document describes the automated token refresh system that prevents authentication failures and ensures uninterrupted QuickBooks integration.

## Token Lifecycle

### Access Token
- **Validity**: ~60 days (actually expires based on Intuit's schedule, typically much longer)
- **Used for**: All API calls to QuickBooks
- **Expires**: Automatic - when expired, returns HTTP 401
- **Refresh method**: Use refresh_token to obtain new access_token

### Refresh Token
- **Validity**: ~100 years (extremely long-lived)
- **Used for**: Obtaining new access tokens
- **Never expires**: In practice, only revoked if user disconnects QB or changes password
- **Risk**: Low - but if revoked, user must reconnect via OAuth

## Automatic Refresh (Cron Job)

### Schedule
- **Endpoint**: `GET/POST /api/cron/refresh-quickbooks-token`
- **Frequency**: Daily at 2 AM UTC (configurable in `vercel.json`)
- **Trigger**: Vercel Cron (no auth required, validated via `x-vercel-cron-secret` header)

### Implementation
**File**: `app/api/cron/refresh-quickbooks-token/route.ts`

```typescript
// Validates Vercel cron secret
// Fetches current tokens from SystemConfig
// If no tokens: logs and returns 200 (nothing to do)
// If tokens exist: calls quickbooksService.refreshAccessTokenDirect()
// Logs all attempts to IntegrationLog table
// Returns 200 even on errors (cron shouldn't fail)
```

### Logging
All refresh attempts logged to `IntegrationLog`:
- `service`: "QUICKBOOKS"
- `action`: "QB_TOKEN_REFRESH_CRON"
- `status`: "SUCCESS" or "ERROR"
- `metadata`: Includes new expiration time on success, error details on failure

### Failure Handling
If refresh fails:
1. Error logged to IntegrationLog
2. Cron returns 200 (doesn't fail)
3. Next daily run will retry
4. Queue monitoring detects token expiry (see below)
5. Operator notified via monitoring dashboard

## Manual Refresh (User Endpoint)

### Endpoint
- **URL**: `POST /api/quickbooks/refresh-token`
- **Authentication**: Required (NextAuth session)
- **Authorization**: ADMIN role only (403 if insufficient)
- **Returns**: `{ success: boolean, message: string, expiresAt: string | null }`

### Usage
User clicks "Refresh Now" button in admin dashboard:
```bash
curl -X POST http://localhost:3000/api/quickbooks/refresh-token \
  -H "Authorization: Bearer [session_token]"
```

### Implementation
**File**: `app/api/quickbooks/refresh-token/route.ts`

```typescript
// Authenticates user (401 if not logged in)
// Checks ADMIN role (403 if not admin)
// Initializes service with current tokens
// Calls quickbooksService.refreshAccessTokenDirect()
// Logs to IntegrationLog with action "QB_TOKEN_REFRESH_MANUAL"
// Includes user email in logs for audit trail
// Returns user-friendly error messages on failure
```

### Success Response
```json
{
  "success": true,
  "message": "QuickBooks token refreshed successfully",
  "expiresAt": "2026-01-15T10:30:45.123Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Refresh token is invalid or revoked. Please reconnect QuickBooks.",
  "error": "[Internal error details]"
}
```

## Token Status Monitoring

### Status Endpoint
- **URL**: `GET /api/quickbooks/token-status`
- **Authentication**: Required (NextAuth session)
- **Authorization**: ADMIN role only
- **Returns**: Token expiration status and health metrics

### Implementation
**File**: `app/api/quickbooks/token-status/route.ts`

Response structure:
```typescript
{
  configured: boolean,              // QB is connected and authenticated
  hasAccessToken: boolean,          // Access token stored in database
  hasRefreshToken: boolean,         // Refresh token stored in database
  expiresAt: string | null,         // Token expiration time (ISO 8601)
  expiresInDays: number | null,     // Days until expiration (null if expired)
  isExpired: boolean,               // Token has already expired
  expiringWithin24Hours: boolean,   // Token expires in next 24 hours
  lastRefreshAttempt: string | null // Last refresh attempt timestamp
}
```

### Usage
Admin dashboard displays token status:
- Green: Token healthy (>7 days remaining)
- Yellow: Token expiring soon (<7 days)
- Red: Token expired
- "Refresh Now" button enabled to trigger manual refresh

## Token Health Monitoring

### Integration with Queue Monitoring
As part of the existing `monitorAllQueues()` cron job (every 4 hours):
- Checks if QB token expires within 7 days
- Logs warning to IntegrationLog if expiring soon
- Logs error if already expired

### Monitoring Details
- **Service**: "QUICKBOOKS"
- **Action**: "TOKEN_HEALTH_CHECK"
- **Status**: "WARNING" (expiring) or "ERROR" (expired)
- **Category**: "QB_TOKEN_HEALTH"
- **Metadata**: Days/hours until expiry

### Alerts
Operators can configure dashboard alerts on IntegrationLog entries with:
- `service` = "QUICKBOOKS"
- `errorCategory` = "QB_TOKEN_HEALTH"
- `errorSeverity` = "warning" or "error"

## Token Storage

Tokens stored in `SystemConfig` table (id="system"):
- `quickbooks_access_token`: Current access token (refreshed daily)
- `quickbooks_refresh_token`: Long-lived refresh token
- `quickbooks_token_expires_at`: Token expiration timestamp
- `quickbooks_is_authenticated`: Authentication status flag
- `quickbooks_company_id`: QuickBooks company ID

Access via Prisma:
```typescript
const config = await prisma.systemConfig.findUnique({
  where: { id: "system" },
});
const accessToken = config?.quickbooks_access_token;
const expiresAt = config?.quickbooks_token_expires_at;
```

## Failure Recovery

### If Manual Refresh Fails

**Reason**: Refresh token invalid, revoked, or corrupted

**Recovery Steps**:
1. User sees error: "Refresh token is invalid or revoked"
2. Navigate to: Settings → Integrations → QuickBooks
3. Click "Disconnect QuickBooks"
4. Click "Connect QuickBooks" to reauthenticate via OAuth
5. Vercel will redirect to QB OAuth flow
6. Upon successful auth, new tokens stored in SystemConfig

**Note**: No data is lost - QB integration resumes after reconnect

### If Automatic Refresh Fails (Cron)

**Detection**:
- Cron job logs error to IntegrationLog
- Queue monitoring detects expired token during next health check
- Dashboard shows "TOKEN_HEALTH_CHECK" error in monitoring logs

**Operator Action**:
1. Review IntegrationLog for "QB_TOKEN_REFRESH_CRON" errors
2. Check if token is still valid (may be transient network error)
3. Manually trigger refresh via admin endpoint if needed
4. If refresh_token invalid, notify user to reconnect QB

**Automatic Recovery**:
- Daily cron retries at 2 AM next day
- If token still valid, refresh succeeds on next run
- No action needed if transient error

## Configuration

### Environment Variables
No additional env vars needed. Uses existing:
- `VERCEL_CRON_SECRET`: Validates cron requests (auto-set by Vercel)
- `QUICKBOOKS_CLIENT_ID`: OAuth client ID
- `QUICKBOOKS_CLIENT_SECRET`: OAuth client secret

### Cron Schedule
Edit `vercel.json`:
```json
{
  "path": "/api/cron/refresh-quickbooks-token",
  "schedule": "0 2 * * *"
}
```

Cron format: `minute hour day month weekday`
- Current: 2 AM UTC daily
- Change `"0 2"` to other times as needed (e.g., `"0 3"` for 3 AM UTC)

## Monitoring Dashboard

### IntegrationLog Queries

**Recent token refresh attempts**:
```sql
SELECT * FROM IntegrationLog
WHERE service = 'QUICKBOOKS'
  AND action IN ('QB_TOKEN_REFRESH_CRON', 'QB_TOKEN_REFRESH_MANUAL')
ORDER BY createdAt DESC
LIMIT 20;
```

**Token health status**:
```sql
SELECT * FROM IntegrationLog
WHERE service = 'QUICKBOOKS'
  AND action = 'TOKEN_HEALTH_CHECK'
ORDER BY createdAt DESC
LIMIT 10;
```

**Failed refreshes**:
```sql
SELECT * FROM IntegrationLog
WHERE service = 'QUICKBOOKS'
  AND action IN ('QB_TOKEN_REFRESH_CRON', 'QB_TOKEN_REFRESH_MANUAL')
  AND status = 'ERROR'
ORDER BY createdAt DESC;
```

## API Reference

### Cron Endpoint
```
GET /api/cron/refresh-quickbooks-token
Header: x-vercel-cron-secret: [secret]

Response (200):
{
  "success": boolean,
  "message": string,
  "tokensRefreshed": boolean,
  "error"?: string
}
```

### Token Status Endpoint
```
GET /api/quickbooks/token-status
Header: Authorization: Bearer [session_token]

Response (200):
{
  "configured": boolean,
  "hasAccessToken": boolean,
  "hasRefreshToken": boolean,
  "expiresAt": "2026-01-15T10:30:45.123Z",
  "expiresInDays": 4,
  "isExpired": false,
  "expiringWithin24Hours": false,
  "lastRefreshAttempt": "2026-01-11T02:00:30.456Z"
}
```

### Manual Refresh Endpoint
```
POST /api/quickbooks/refresh-token
Header: Authorization: Bearer [session_token]

Response (200):
{
  "success": boolean,
  "message": string,
  "expiresAt": "2026-01-15T10:30:45.123Z"
}
```

## Testing

### Local Testing

**Start dev server**:
```bash
npm run dev
```

**Test token status**:
```bash
curl -X GET http://localhost:3000/api/quickbooks/token-status \
  -H "Authorization: Bearer [your_session_token]" \
  -H "Content-Type: application/json"
```

**Test manual refresh**:
```bash
curl -X POST http://localhost:3000/api/quickbooks/refresh-token \
  -H "Authorization: Bearer [your_session_token]" \
  -H "Content-Type: application/json"
```

**Test cron endpoint** (with secret):
```bash
curl -X GET http://localhost:3000/api/cron/refresh-quickbooks-token \
  -H "x-vercel-cron-secret: your-secret" \
  -H "Content-Type: application/json"
```

### Database Inspection
```bash
npm run db:studio
# Navigate to SystemConfig table
# Check quickbooks_token_expires_at field
```

### IntegrationLog Inspection
```bash
npm run db:studio
# Query IntegrationLog table
# Filter by service='QUICKBOOKS' to see all token operations
```

## Troubleshooting

### Token Always Expires
**Symptom**: Token expires every few days instead of 60 days

**Cause**: `expires_in` from QB API being misinterpreted

**Fix**: Check QuickBooks API response in logs
- `expiresIn = data.expires_in || 3600`
- If QB returns seconds, this is correct
- If QB returns milliseconds, divide by 1000

### Refresh Fails Silently
**Symptom**: Cron logs success but token not updated

**Cause**: Database upsert not working or credentials invalid

**Debug**:
1. Check IntegrationLog for actual error details
2. Verify `QUICKBOOKS_CLIENT_ID` and `CLIENT_SECRET` in .env
3. Verify refresh_token exists in SystemConfig
4. Check QB API status page

### Manual Refresh Not Working
**Symptom**: 403 Forbidden when calling manual refresh endpoint

**Cause**: User not ADMIN role

**Fix**: Verify user.role = "ADMIN" in database

### Cron Not Running
**Symptom**: No entries in IntegrationLog for cron job

**Cause**: Vercel deployment issue or cron secret mismatch

**Debug**:
1. Check vercel.json includes refresh-quickbooks-token endpoint
2. Verify `VERCEL_CRON_SECRET` env var is set in Vercel dashboard
3. Check Vercel build logs for errors
4. Manually invoke endpoint to verify it works

## Security Considerations

### Token Protection
- Tokens stored in database, never in environment variables
- Tokens not logged in plaintext (only action/status logged)
- Refresh token is long-lived and should be treated as sensitive
- If refresh_token compromised, attacker can generate unlimited access tokens

### Access Control
- Token status endpoint: ADMIN only
- Manual refresh endpoint: ADMIN only
- Cron endpoint: No auth, validated via secret header
- Logs include user email for audit trail

### Secret Rotation
If refresh_token compromised:
1. User disconnects QB integration
2. User reconnects via OAuth (new tokens issued)
3. Old refresh_token becomes useless (new one issued)
4. No manual secret rotation needed

## Metrics & Alerts

### Key Metrics
- Token refresh success rate (daily)
- Average token age (days until expiry)
- Failed refresh attempts per week
- Tokens expiring within 7 days

### Recommended Alerts
1. **Refresh failed**: Error in IntegrationLog for QB_TOKEN_REFRESH_CRON
2. **Token expiring soon**: Warning in IntegrationLog for TOKEN_HEALTH_CHECK (< 7 days)
3. **Token expired**: Error in IntegrationLog for TOKEN_HEALTH_CHECK (already expired)
4. **High refresh failure rate**: >2 failures in 24 hours

## Related Files

- **Service**: `lib/services/quickbooks.service.ts`
- **Cron endpoint**: `app/api/cron/refresh-quickbooks-token/route.ts`
- **Status endpoint**: `app/api/quickbooks/token-status/route.ts`
- **Manual refresh**: `app/api/quickbooks/refresh-token/route.ts`
- **Queue monitoring**: `lib/utils/queue-monitor.ts` (token health check)
- **Configuration**: `vercel.json` (cron schedule)
- **Auth config**: `lib/auth.ts` (NextAuth session management)

## Future Enhancements

1. **Dashboard UI**: Display token status and refresh button in settings
2. **Webhook support**: Receive notifications when QB revokes token
3. **Multiple QB accounts**: Support multiple QB company connections
4. **Token rotation policy**: Configurable minimum days between refreshes
5. **Automatic disconnect**: Auto-disconnect if refresh fails N times in a row
