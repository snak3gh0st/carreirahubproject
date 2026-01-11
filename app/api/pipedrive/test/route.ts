import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/pipedrive/test
 *
 * Testa a conexão com a API do Pipedrive
 * Valida que as credenciais estão configuradas corretamente
 */
export async function GET(request: NextRequest) {
  try {
    const apiToken = process.env.PIPEDRIVE_API_TOKEN;
    const companyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN;

    if (!apiToken) {
      return NextResponse.json(
        {
          status: "error",
          message: "PIPEDRIVE_API_TOKEN não está configurado",
          configured: false,
        },
        { status: 400 }
      );
    }

    if (!companyDomain) {
      return NextResponse.json(
        {
          status: "error",
          message: "PIPEDRIVE_COMPANY_DOMAIN não está configurado",
          configured: false,
        },
        { status: 400 }
      );
    }

    console.log("[Pipedrive] Testando conexão com API");

    // Testar conexão chamando um endpoint simples
    const response = await fetch(
      `https://${companyDomain}.pipedrive.com/v1/users/me?api_token=${apiToken}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Pipedrive] Erro na chamada de teste:", errorData);

      if (response.status === 401) {
        return NextResponse.json(
          {
            status: "error",
            message: "Token de API inválido ou expirado",
            configured: false,
            details: "API retornou 401 Unauthorized",
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          status: "error",
          message: "Erro ao validar credenciais",
          configured: false,
          details: errorData,
        },
        { status: 400 }
      );
    }

    const userData = await response.json();

    if (!userData.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "API retornou sucesso=false",
          configured: false,
          details: userData,
        },
        { status: 400 }
      );
    }

    console.log("[Pipedrive] Conexão validada com sucesso");

    return NextResponse.json({
      status: "success",
      message: "Conexão com Pipedrive validada com sucesso",
      configured: true,
      user: {
        id: userData.data?.id,
        name: userData.data?.name,
        email: userData.data?.email,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Pipedrive] Erro ao testar conexão:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Erro ao testar conexão com Pipedrive",
        configured: false,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
