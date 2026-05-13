import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExpectedQuickBooksRealmId } from "@/lib/quickbooks/master-company";

/**
 * GET /api/quickbooks/auth/connect
 *
 * Inicia o fluxo de autenticação OAuth 2.0 do QuickBooks
 * Redireciona para o servidor de autorização da Intuit
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const environment = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";

    if (!clientId) {
      return NextResponse.json(
        { error: "QUICKBOOKS_CLIENT_ID não configurado no .env" },
        { status: 400 }
      );
    }

    // URL de callback - deve ser registrada no Intuit Developer Portal
    const redirectUri =
      process.env.QUICKBOOKS_REDIRECT_URI ||
      "https://app.carreirausa.com/api/quickbooks/oauth/callback";

    // Configurar state para CSRF protection
    const state = Buffer.from(
      Math.random().toString() + Date.now().toString()
    ).toString("base64");

    const expectedRealmId = getExpectedQuickBooksRealmId();

    // Guardar state em cookie (será validado no callback)
    const authUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      "com.intuit.quickbooks.accounting com.intuit.quickbooks.payment"
    );
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);

    // Salvar state em cookie seguro
    // sameSite: "lax" permite que o cookie seja enviado no redirect de volta do QuickBooks
    response.cookies.set("qb_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutos
      path: "/",
    });

    if (expectedRealmId) {
      response.cookies.set("qb_expected_realm", expectedRealmId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
    }

    console.log("[QuickBooks Auth] Iniciando fluxo OAuth");
    console.log(`[QuickBooks Auth] Client ID: ${clientId}`);
    console.log(`[QuickBooks Auth] Redirect URI: ${redirectUri}`);
    console.log(`[QuickBooks Auth] Environment: ${environment}`);
    console.log(`[QuickBooks Auth] Expected Realm: ${expectedRealmId || "not set"}`);

    return response;
  } catch (error) {
    console.error("[QuickBooks Auth] Erro ao iniciar fluxo OAuth:", error);
    return NextResponse.json(
      {
        error: "Falha ao iniciar autenticação",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
