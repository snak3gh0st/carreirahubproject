import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HubHomeView } from "@/components/hub/HubHomeView";
import type { Language } from "@/lib/i18n/hub";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

function normalizeLanguage(value: unknown): Language {
  return value === "pt-BR" ? "pt-BR" : "en";
}

export default async function HubHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");

  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  return (
    <HubHomeView
      customerId={payload.customerId}
      lang={normalizeLanguage(payload.language)}
      identity={{ name: payload.name, email: payload.email }}
    />
  );
}
