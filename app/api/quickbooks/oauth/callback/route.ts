import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getExpectedQuickBooksRealmId } from "@/lib/quickbooks/master-company";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/oauth/callback
 *
 * Callback da autorização OAuth 2.0 do QuickBooks
 * Troca o authorization code por access_token e refresh_token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const realmId = searchParams.get("realmId"); // Company ID do QuickBooks
    const state = searchParams.get("state");

    // Validar state (CSRF protection)
    const storedState = request.cookies.get("qb_oauth_state")?.value;
    const expectedRealmId =
      request.cookies.get("qb_expected_realm")?.value ||
      getExpectedQuickBooksRealmId();
    console.log("[QuickBooks Auth] State from URL:", state);
    console.log("[QuickBooks Auth] State from cookie:", storedState);
    console.log("[QuickBooks Auth] All cookies:", request.cookies.getAll().map(c => c.name));

    if (!state || state !== storedState) {
      console.error("[QuickBooks Auth] State mismatch - CSRF attack detectado");
      console.error("[QuickBooks Auth] Expected:", storedState);
      console.error("[QuickBooks Auth] Received:", state);

      // Se não houver cookie mas houver state, pode ser problema de cookie
      if (!storedState && state) {
        console.error("[QuickBooks Auth] Cookie não encontrado - pode ser problema de sameSite/secure");
        return NextResponse.json(
          {
            error: "State mismatch - cookie não encontrado",
            hint: "O cookie de state não foi preservado. Tente limpar os cookies e tentar novamente."
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "State mismatch - autenticação rejeitada" },
        { status: 403 }
      );
    }

    if (!code || !realmId) {
      console.error(
        "[QuickBooks Auth] Código de autorização ou Realm ID ausente"
      );
      return NextResponse.json(
        { error: "Código de autorização ausente" },
        { status: 400 }
      );
    }

    if (expectedRealmId && expectedRealmId !== realmId) {
      console.error(
        "[QuickBooks Auth] Realm retornado pela Intuit não bate com a empresa esperada",
        { expectedRealmId, receivedRealmId: realmId }
      );

      const response = NextResponse.json(
        {
          error: "Empresa QuickBooks incorreta",
          message:
            "A Intuit devolveu uma empresa diferente da empresa Carreira USA esperada. Entre no QuickBooks correto e refaça a conexão.",
          expectedRealmId,
          receivedRealmId: realmId,
        },
        { status: 400 }
      );
      response.cookies.delete("qb_oauth_state");
      response.cookies.delete("qb_expected_realm");
      return response;
    }

    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            "Credenciais QuickBooks não configuradas no servidor",
        },
        { status: 500 }
      );
    }

    console.log("[QuickBooks Auth] Trocando authorization code por tokens");
    console.log(`[QuickBooks Auth] Realm ID: ${realmId}`);

    // Trocar authorization code por access token
    // Codificar credenciais em Basic Auth
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const redirectUri =
      process.env.QUICKBOOKS_REDIRECT_URI ||
      "https://app.carreirausa.com/api/quickbooks/oauth/callback";

    const tokenResponse = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(
        "[QuickBooks Auth] Erro ao trocar código por token:",
        errorText
      );
      return NextResponse.json(
        { error: "Falha na autenticação QuickBooks", details: errorText },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();

    const expiresIn = tokenData.expires_in || 3600; // padrão 1 hora
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Salvar tokens no banco de dados
    await prisma.systemConfig.upsert({
      where: { id: "system" },
      update: {
        quickbooks_access_token: tokenData.access_token,
        quickbooks_refresh_token: tokenData.refresh_token,
        quickbooks_token_expires_at: expiresAt,
        quickbooks_company_id: realmId,
        quickbooks_is_authenticated: true,
        updatedAt: new Date(),
      },
      create: {
        id: "system",
        quickbooks_access_token: tokenData.access_token,
        quickbooks_refresh_token: tokenData.refresh_token,
        quickbooks_token_expires_at: expiresAt,
        quickbooks_company_id: realmId,
        quickbooks_is_authenticated: true,
      },
    });

    console.log(
      "[QuickBooks Auth] Tokens salvos no banco com sucesso"
    );

    // Limpar cookie de state
    const response = NextResponse.redirect(
      new URL("/dashboard/integrations?qb_auth=success", request.url)
    );
    response.cookies.delete("qb_oauth_state");
    response.cookies.delete("qb_expected_realm");

    return response;
  } catch (error) {
    console.error("[QuickBooks Auth] Erro no callback OAuth:", error);
    return NextResponse.json(
      {
        error: "Erro ao processar autenticação",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
