import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/quickbooks/auth/connect
 *
 * Inicia o fluxo de autenticação OAuth 2.0 do QuickBooks
 * Redireciona para o servidor de autorização da Intuit
 */
export async function GET(request: NextRequest) {
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

    // Guardar state em cookie (será validado no callback)
    const response = NextResponse.redirect(
      `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&response_type=code&scope=com.intuit.quickbooks.accounting%20com.intuit.quickbooks.payment&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
    );

    // Salvar state em cookie seguro
    // sameSite: "lax" permite que o cookie seja enviado no redirect de volta do QuickBooks
    response.cookies.set("qb_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutos
      path: "/",
    });

    console.log("[QuickBooks Auth] Iniciando fluxo OAuth");
    console.log(`[QuickBooks Auth] Client ID: ${clientId}`);
    console.log(`[QuickBooks Auth] Redirect URI: ${redirectUri}`);
    console.log(`[QuickBooks Auth] Environment: ${environment}`);

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
