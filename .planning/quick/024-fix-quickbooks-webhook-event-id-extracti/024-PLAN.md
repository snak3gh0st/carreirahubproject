---
id: quick-024
type: quick
title: Fix QuickBooks webhook event ID extraction
created: 2026-01-28
estimated_effort: 15 min
files_modified:
  - lib/utils/webhook-event-id.ts
---

<objective>
Fix QuickBooks webhook event ID extraction to handle the transformed payload structure introduced in the January 12, 2026 refactor.

Purpose: Restore real-time QuickBooks webhook sync which has been broken since January 12. The webhook route transforms the QuickBooks payload to a simplified structure, but the event ID extractor still expects the original QuickBooks structure.

Output: Working webhook deduplication that extracts event IDs from the transformed payload format.
</objective>

<context>
@lib/utils/webhook-event-id.ts (needs fix)
@lib/utils/webhook-handler.ts (context - calls extractEventId)
@app/api/webhooks/quickbooks/route.ts (context - shows transformed structure)
</context>

<problem_analysis>
**Current State:**
- Webhook route (line 161-178) calls `acceptWebhook()` with a TRANSFORMED payload:
  ```typescript
  {
    realmId: notification.realmId,
    entity: {
      name,
      operation,
      id,
      lastUpdated: entity.lastUpdated,
    },
    originalNotification: notification,
  }
  ```

- Event ID extractor (line 38-44) expects ORIGINAL QuickBooks payload:
  ```typescript
  const realmId = payload?.eventNotifications?.[0]?.realmId;
  const entityId = payload?.eventNotifications?.[0]?.dataChangeEvent?.entities?.[0]?.id;
  return realmId && entityId ? `${realmId}-${entityId}` : null;
  ```

**Result:** `realmId` and `entityId` are both undefined, extraction returns null, acceptWebhook throws "Failed to extract event ID from payload", all webhooks fail.

**Fix Required:**
Update the QuickBooks case in extractEventId to handle the transformed structure:
- `payload.realmId` (top-level, not nested)
- `payload.entity.id` (direct property, not deeply nested)
</problem_analysis>

<tasks>

<task type="auto">
  <name>Task 1: Update QuickBooks event ID extraction for transformed payload</name>
  <files>lib/utils/webhook-event-id.ts</files>
  <action>
  Update the `quickbooks` case in `extractEventId()` function to handle the transformed payload structure.

  The fix must:
  1. Check for the NEW transformed structure FIRST:
     - `payload.realmId` (string) - top-level property
     - `payload.entity?.id` (string) - entity ID
     - Combine as: `${realmId}-${entityId}`

  2. Fall back to the ORIGINAL structure for backward compatibility (direct QB API calls):
     - `payload.eventNotifications?.[0]?.realmId`
     - `payload.eventNotifications?.[0]?.dataChangeEvent?.entities?.[0]?.id`

  Updated code for the quickbooks case:
  ```typescript
  case "quickbooks":
    // NEW: Transformed payload from webhook route (Jan 2026 refactor)
    // Structure: { realmId, entity: { id, name, operation } }
    if (payload?.realmId && payload?.entity?.id) {
      return `${payload.realmId}-${payload.entity.id}`;
    }
    // LEGACY: Original QuickBooks webhook payload structure
    // Structure: { eventNotifications: [{ realmId, dataChangeEvent: { entities: [{ id }] } }] }
    const legacyRealmId = payload?.eventNotifications?.[0]?.realmId;
    const legacyEntityId = payload?.eventNotifications?.[0]?.dataChangeEvent?.entities?.[0]?.id;
    return legacyRealmId && legacyEntityId ? `${legacyRealmId}-${legacyEntityId}` : null;
  ```

  Do NOT change any other cases (pipedrive, stripe, docusign, twilio, retell).
  </action>
  <verify>
  1. TypeScript compiles: `npx tsc --noEmit lib/utils/webhook-event-id.ts`
  2. Manual verification: The transformed payload structure matches what webhook route passes:
     - Has `realmId` at top level
     - Has `entity.id` property
  </verify>
  <done>
  - QuickBooks case handles both transformed and original payload structures
  - Event ID successfully extracted as `{realmId}-{entityId}` format
  - No TypeScript errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify fix with integration log check</name>
  <files>N/A (verification only)</files>
  <action>
  After deploying (or in local dev), verify the fix works by:

  1. Check recent integration logs for WEBHOOK_ACCEPT_ERROR with "Failed to extract event ID":
     - These should STOP appearing after the fix

  2. Check for new WEBHOOK_ACCEPTED logs for QUICKBOOKS service:
     - These should START appearing after the fix

  If running locally, you can test with a curl command simulating the transformed payload:
  ```bash
  # This is just for documentation - actual webhook comes from QuickBooks
  # The fix allows acceptWebhook to process payloads like:
  # { realmId: "123", entity: { id: "456", name: "Invoice", operation: "Update" } }
  ```
  </action>
  <verify>
  Check Prisma Studio or database query:
  ```sql
  SELECT action, status, error, created_at
  FROM "IntegrationLog"
  WHERE service = 'QUICKBOOKS'
  AND action IN ('WEBHOOK_ACCEPT_ERROR', 'WEBHOOK_ACCEPTED')
  ORDER BY created_at DESC
  LIMIT 20;
  ```

  Success criteria: No new WEBHOOK_ACCEPT_ERROR entries with "Failed to extract event ID" message.
  </verify>
  <done>
  - Integration logs show WEBHOOK_ACCEPTED instead of WEBHOOK_ACCEPT_ERROR
  - QuickBooks real-time sync is restored
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. Code handles both transformed and legacy payload structures
3. Event ID format remains consistent: `{realmId}-{entityId}`
</verification>

<success_criteria>
- QuickBooks webhooks no longer fail with "Failed to extract event ID from payload"
- Event ID extraction works for the transformed payload: `{ realmId, entity: { id } }`
- Backward compatibility maintained for original QuickBooks payload structure
- Real-time QuickBooks sync restored (customer/invoice updates appear in Hub)
</success_criteria>

<output>
After completion, update `.planning/STATE.md` and create `.planning/quick/024-fix-quickbooks-webhook-event-id-extracti/024-SUMMARY.md`
</output>
