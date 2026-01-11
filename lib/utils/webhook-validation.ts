import { createHmac } from "crypto";

/**
 * Validar assinatura de webhook do QuickBooks
 *
 * QuickBooks envia um header "intuit-signature" que é:
 * intuit-signature = base64(HMAC-SHA256(payload, secret))
 */
export function validateQuickBooksWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn("[Webhook] Validação de assinatura pulada - secret não configurado");
    return false;
  }

  const payloadBuffer = typeof payload === "string" ? Buffer.from(payload) : payload;
  const expectedSignature = createHmac("sha256", secret)
    .update(payloadBuffer)
    .digest("base64");

  // Comparação segura contra timing attacks
  return expectedSignature === signature;
}

/**
 * Validar assinatura de webhook do Pipedrive
 *
 * Pipedrive envia um header "X-Pipedrive-Signature" que é:
 * X-Pipedrive-Signature = base64(HMAC-SHA256(payload, secret))
 *
 * Ref: https://developers.pipedrive.com/docs/api/webhooks#validating-webhooks
 */
export function validatePipedriveWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn("[Webhook] Validação de assinatura Pipedrive pulada - secret não configurado");
    return false;
  }

  const payloadBuffer = typeof payload === "string" ? Buffer.from(payload) : payload;
  const expectedSignature = createHmac("sha256", secret)
    .update(payloadBuffer)
    .digest("base64");

  // Comparação segura contra timing attacks
  return expectedSignature === signature;
}

/**
 * Extrair payload bruto do request para validação de assinatura
 * IMPORTANTE: Deve ser chamado ANTES de fazer .json() no request body
 */
export async function getRawBodyForValidation(
  request: Request
): Promise<{ body: Buffer; text: string }> {
  const arrayBuffer = await request.arrayBuffer();
  const body = Buffer.from(arrayBuffer);
  const text = body.toString("utf-8");

  return { body, text };
}
