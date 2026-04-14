export function logAiEvent(event: {
  kind: 'request' | 'tool_call' | 'error' | 'finish';
  userId: string;
  conversationId?: string;
  toolName?: string;
  error?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
}): void {
  console.log(JSON.stringify({ ai: true, ts: new Date().toISOString(), ...event }));
}
