import { resolveAiGatewayModel } from "@/lib/ai/gateway";

export function resolveDashboardAiModel(preferredModel?: string): string {
  return resolveAiGatewayModel({
    task: "dashboard_copilot",
    preferredModel,
  });
}
