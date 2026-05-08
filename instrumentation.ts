export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

export async function onRequestError(
  err: unknown,
  request: unknown,
  context: unknown
) {
  const { captureRequestError } = await import("@sentry/nextjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  captureRequestError(err, request as any, context as any);
}
