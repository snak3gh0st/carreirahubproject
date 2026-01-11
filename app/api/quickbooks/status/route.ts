import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/status
 *
 * Retorna o status da configuração do QuickBooks
 * Verifica tanto variáveis de ambiente quanto tokens salvos no banco
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check environment variables
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const environment = process.env.QUICKBOOKS_ENVIRONMENT;

  const hasClientId = !!clientId && clientId.trim() !== "";
  const hasClientSecret = !!clientSecret && clientSecret.trim() !== "";
  const isProduction = environment === "production";

  // Check database for OAuth tokens
  let dbConfig = null;
  try {
    dbConfig = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });
  } catch (error) {
    console.error("[QuickBooks Status] Error fetching config from DB:", error);
  }

  const isAuthenticated = dbConfig?.quickbooks_is_authenticated || false;
  const hasAccessToken = !!dbConfig?.quickbooks_access_token;
  const hasRefreshToken = !!dbConfig?.quickbooks_refresh_token;
  const hasCompanyId = !!dbConfig?.quickbooks_company_id;
  const tokenExpiresAt = dbConfig?.quickbooks_token_expires_at;
  const isTokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < new Date() : true;

  // Fully configured = has credentials + authenticated via OAuth
  const isConfigured = hasClientId && hasClientSecret && isAuthenticated && hasAccessToken && hasCompanyId;

  return NextResponse.json({
    configured: isConfigured,
    connected: isAuthenticated,
    environment: isProduction ? "production" : "sandbox",
    details: {
      clientId: hasClientId ? "✓ Configurado" : "✗ Não configurado",
      clientSecret: hasClientSecret ? "✓ Configurado" : "✗ Não configurado",
      oauthConnected: isAuthenticated ? "✓ Conectado" : "✗ Não conectado",
      accessToken: hasAccessToken ? "✓ Presente" : "✗ Ausente",
      refreshToken: hasRefreshToken ? "✓ Presente" : "○ Ausente",
      companyId: hasCompanyId ? `✓ ${dbConfig?.quickbooks_company_id}` : "✗ Não configurado",
      tokenStatus: hasAccessToken
        ? isTokenExpired
          ? "⚠ Expirado (será renovado automaticamente)"
          : `✓ Válido até ${tokenExpiresAt?.toLocaleString()}`
        : "✗ Sem token",
    },
    message: isConfigured
      ? "QuickBooks está conectado e pronto para uso"
      : isAuthenticated
      ? "QuickBooks conectado mas faltam credenciais no .env"
      : hasClientId && hasClientSecret
      ? "Credenciais configuradas. Clique em 'Conectar' para autenticar via OAuth."
      : "Configure QUICKBOOKS_CLIENT_ID e QUICKBOOKS_CLIENT_SECRET no .env",
  });
}
