import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/quickbooks/auth/callback
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
    if (!state || state !== storedState) {
      console.error("[QuickBooks Auth] State mismatch - CSRF attack detectado");
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
    const tokenResponse = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri:
            `${process.env.NODE_ENV === "production" ? "https" : "http"}://${request.headers.get("host")}/api/quickbooks/auth/callback`,
        }).toString(),
        // Usar Basic Auth com client_id:client_secret
        auth: {
          username: clientId,
          password: clientSecret,
        },
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
      new URL("/dashboard?qb_auth=success", request.url)
    );
    response.cookies.delete("qb_oauth_state");

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
