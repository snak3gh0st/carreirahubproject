/**
 * Error Fallback Response Generator
 *
 * Creates user-friendly, actionable error responses for API endpoints
 * that abstract away internal system details while providing guidance
 */

export interface FallbackResponse {
  success: false;
  message: string;
  recoveryAction: "wait" | "reconnect_integration" | "contact_support" | "retry";
  estimatedRecoveryTime?: string;
  actionUrl?: string;
  supportLink?: string;
}

/**
 * Generate a user-friendly fallback response based on error category
 *
 * @param serviceName - Service that failed (e.g., "pipedrive", "quickbooks")
 * @param action - Action that failed (e.g., "create_lead", "sync_invoice")
 * @param errorCategory - Error category from structured error logging (transient, permanent, auth, validation, unknown)
 * @returns User-friendly fallback response
 */
export function createUserFallbackResponse(
  serviceName: string,
  action: string,
  errorCategory: "transient" | "permanent" | "auth" | "validation" | "unknown"
): FallbackResponse {
  const serviceDisplayName = getServiceDisplayName(serviceName);
  const actionDisplay = humanizeAction(action);

  switch (errorCategory) {
    case "transient":
      return createTransientErrorResponse(serviceDisplayName, actionDisplay);

    case "auth":
      return createAuthErrorResponse(serviceName, serviceDisplayName);

    case "validation":
      return createValidationErrorResponse(actionDisplay);

    case "permanent":
      return createPermanentErrorResponse(serviceDisplayName, actionDisplay);

    case "unknown":
    default:
      return createUnknownErrorResponse(serviceDisplayName);
  }
}

/**
 * Transient errors (timeouts, rate limits, service unavailable)
 * User should wait and the system will retry automatically
 */
function createTransientErrorResponse(
  serviceName: string,
  action: string
): FallbackResponse {
  return {
    success: false,
    message: `${serviceName} is temporarily unavailable. Your ${action} is being queued and will be processed automatically when the service recovers.`,
    recoveryAction: "wait",
    estimatedRecoveryTime: "5-15 minutes",
  };
}

/**
 * Authentication errors (expired tokens, invalid credentials)
 * User needs to reconnect the integration
 */
function createAuthErrorResponse(
  serviceName: string,
  serviceDisplayName: string
): FallbackResponse {
  return {
    success: false,
    message: `${serviceDisplayName} authentication has expired. Please reconnect your integration to continue.`,
    recoveryAction: "reconnect_integration",
    actionUrl: `/dashboard/settings/integrations/${serviceName}`,
    supportLink: "https://docs.carreirausa.com/help/reconnect-integration",
  };
}

/**
 * Validation errors (bad request, missing fields, invalid data)
 * Client needs to check their input
 */
function createValidationErrorResponse(action: string): FallbackResponse {
  return {
    success: false,
    message: `The ${action} contains invalid data. Please check your input and try again. If the problem persists, contact support.`,
    recoveryAction: "contact_support",
    supportLink: "https://support.carreirausa.com",
  };
}

/**
 * Permanent errors (not found, forbidden, etc.)
 * Operator/support needs to investigate
 */
function createPermanentErrorResponse(
  serviceName: string,
  action: string
): FallbackResponse {
  return {
    success: false,
    message: `Unable to complete ${action} due to a system issue with ${serviceName}. Our support team has been notified and will investigate.`,
    recoveryAction: "contact_support",
    supportLink: "https://support.carreirausa.com/urgent",
  };
}

/**
 * Unknown errors (unexpected, unclassified)
 * Generic fallback message
 */
function createUnknownErrorResponse(serviceName: string): FallbackResponse {
  return {
    success: false,
    message: `An unexpected error occurred with ${serviceName}. Please try again or contact support if the problem persists.`,
    recoveryAction: "contact_support",
    supportLink: "https://support.carreirausa.com",
  };
}

/**
 * Get human-readable service name
 */
function getServiceDisplayName(serviceName: string): string {
  const displayNames: Record<string, string> = {
    pipedrive: "Pipedrive",
    quickbooks: "QuickBooks",
    docusign: "DocuSign",
    whatsapp: "WhatsApp",
    retell: "RetellAI",
    openai: "OpenAI",
    email: "Email Service",
  };

  return displayNames[serviceName] || serviceName;
}

/**
 * Convert action name to human-readable form
 * e.g., "create_lead" -> "lead creation"
 */
function humanizeAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Map HTTP status code to error category
 * Useful for services that don't provide structured error codes
 */
export function categorizeByStatusCode(
  statusCode?: number
): "transient" | "permanent" | "auth" | "validation" | "unknown" {
  if (!statusCode) return "unknown";

  if (statusCode === 429 || statusCode === 503 || statusCode === 504) {
    return "transient";
  }

  if (statusCode === 401 || statusCode === 403) {
    return "auth";
  }

  if (statusCode === 400 || statusCode === 422) {
    return "validation";
  }

  if (statusCode === 404 || statusCode === 410) {
    return "permanent";
  }

  if (statusCode >= 500) {
    return "transient"; // Server errors are usually transient
  }

  return "unknown";
}

/**
 * Create a generic retry message
 * Used when the API route wants to tell user to retry after delay
 */
export function createRetryableResponse(
  message: string,
  delaySeconds: number = 30
): FallbackResponse {
  return {
    success: false,
    message: `${message} Please try again in ${delaySeconds} seconds.`,
    recoveryAction: "retry",
    estimatedRecoveryTime: `${delaySeconds} seconds`,
  };
}
