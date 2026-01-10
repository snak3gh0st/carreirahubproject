import { createHash } from "crypto";

/**
 * Extract event ID from webhook payloads for deduplication
 *
 * Each webhook provider has different event ID formats:
 * - Pipedrive: V2 webhooks use meta.v or data.id, V1 webhooks use current.id
 * - QuickBooks: Combination of realmId + entity ID for uniqueness
 * - Stripe: Top-level id field
 * - DocuSign: eventId or envelopeId as fallback
 * - Twilio: MessageSid for WhatsApp messages
 * - RetellAI: call_id
 *
 * If no event ID is available, generates a deterministic SHA-256 hash of the payload.
 *
 * @param service Service name (e.g., "pipedrive", "quickbooks", "stripe")
 * @param payload Raw webhook payload
 * @returns Event ID string or null if extraction fails
 */
export function extractEventId(service: string, payload: any): string | null {
  if (!payload) {
    return null;
  }

  switch (service.toLowerCase()) {
    case "pipedrive":
      // V2 webhooks: body.meta.v or body.data.id
      // V1 webhooks: body.current.id
      // Example V2: { meta: { v: "1234567890" }, data: { id: 123 } }
      // Example V1: { current: { id: 123 } }
      return (
        payload?.meta?.v?.toString() ||
        payload?.data?.id?.toString() ||
        payload?.current?.id?.toString() ||
        null
      );

    case "quickbooks":
      // Combine realmId + entity ID for uniqueness
      // Example: { eventNotifications: [{ realmId: "123", dataChangeEvent: { entities: [{ id: "456" }] } }] }
      const realmId = payload?.eventNotifications?.[0]?.realmId;
      const entityId =
        payload?.eventNotifications?.[0]?.dataChangeEvent?.entities?.[0]?.id;
      return realmId && entityId ? `${realmId}-${entityId}` : null;

    case "stripe":
      // Stripe events have top-level id field
      // Example: { id: "evt_1234567890", ... }
      return payload?.id || null;

    case "docusign":
      // Use eventId or envelopeId as fallback
      // Example: { eventId: "abc123", data: { envelopeId: "env_456" } }
      return payload?.eventId || payload?.data?.envelopeId || null;

    case "twilio":
      // Use MessageSid for WhatsApp messages
      // Example: { MessageSid: "SM1234567890", ... }
      return payload?.MessageSid || null;

    case "retell":
    case "retellai":
      // Use call_id from RetellAI
      // Example: { call_id: "call_1234567890", ... }
      return payload?.call_id || null;

    default:
      // Fallback: generate deterministic hash of payload if no event ID available
      // This ensures we can deduplicate even for unknown webhook providers
      const hash = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      return hash;
  }
}

/**
 * Validate that an event ID is suitable for deduplication
 *
 * Event IDs should be:
 * - Non-empty strings
 * - Reasonably short (< 500 chars to fit in database)
 * - Not just whitespace
 *
 * @param eventId Event ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidEventId(eventId: string | null): boolean {
  if (!eventId || typeof eventId !== "string") {
    return false;
  }

  const trimmed = eventId.trim();
  return trimmed.length > 0 && trimmed.length < 500;
}

/**
 * Extract and validate event ID from webhook payload
 *
 * Convenience function that combines extraction and validation.
 * Returns null if extraction fails or event ID is invalid.
 *
 * @param service Service name
 * @param payload Raw webhook payload
 * @returns Valid event ID or null
 */
export function getValidEventId(
  service: string,
  payload: any
): string | null {
  const eventId = extractEventId(service, payload);
  return isValidEventId(eventId) ? eventId : null;
}
