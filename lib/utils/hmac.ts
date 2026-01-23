import * as crypto from 'crypto';

/**
 * Verify HMAC-SHA256 signature for webhook payloads
 *
 * CRITICAL: Must be called with raw body (string), NOT parsed JSON.
 * JSON parsing changes whitespace/ordering which breaks signature verification.
 *
 * @param rawBody - The raw request body as string (use request.text(), NOT request.json())
 * @param signature - The signature from webhook header (e.g., X-DocuSign-Signature-1)
 * @param secret - The webhook secret configured in the external service
 * @returns true if signature is valid, false otherwise
 */
export function verifyHmacSignature(
  rawBody: string,
  signature: string | null,
  secret: string | null
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // If buffers are different lengths, timingSafeEqual throws
    return false;
  }
}
