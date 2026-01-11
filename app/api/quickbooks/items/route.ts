import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if QuickBooks is connected
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    if (!config?.quickbooks_is_authenticated) {
      console.warn("[QuickBooks Items] QuickBooks not authenticated");
      return NextResponse.json([
        {
          id: "demo-service-1",
          name: "Consultoria (Demo - QB não conectado)",
          description: "Item de serviço fictício - Conecte o QuickBooks para ver itens reais",
          unitPrice: 1000,
          type: "Service",
        },
        {
          id: "demo-service-2",
          name: "Assessoria (Demo - QB não conectado)",
          description: "Item de serviço fictício - Conecte o QuickBooks para ver itens reais",
          unitPrice: 500,
          type: "Service",
        },
      ]);
    }

    // Initialize QuickBooks service to load tokens from database
    await quickbooksService.initialize();

    console.log("[QuickBooks Items] Fetching service items...");
    const items = await quickbooksService.getServiceItems();
    console.log(`[QuickBooks Items] Got ${items?.length || 0} items from service`);

    // If no items found in QuickBooks, return helpful message
    if (!items || items.length === 0) {
      console.warn("[QuickBooks Items] No items found in QuickBooks account");

      // Try to get ALL items to see what types exist
      try {
        const allItems = await quickbooksService.getAllItems(100);
        const types = [...new Set(allItems.map((i: any) => i.Type))];
        console.log(`[QuickBooks Items] All items in QB (${allItems.length}): Types found: ${types.join(", ")}`);

        if (allItems.length > 0) {
          return NextResponse.json([
            {
              id: "wrong-item-types",
              name: `Items found but wrong type (${types.join(", ")})`,
              description: `QuickBooks has ${allItems.length} items but they are type: ${types.join(", ")}. Create Service or Non-inventory items in Products & Services.`,
              unitPrice: 0,
              type: "Info",
            },
          ]);
        }
      } catch (debugError) {
        console.error("[QuickBooks Items] Debug query failed:", debugError);
      }

      return NextResponse.json([
        {
          id: "no-items-found",
          name: "Nenhum item encontrado no QuickBooks",
          description: "Crie itens de serviço no QuickBooks (Products & Services) para usá-los aqui",
          unitPrice: 0,
          type: "Info",
        },
      ]);
    }

    console.log(`[QuickBooks Items] Returning ${items.length} items: ${items.map(i => `${i.name} (${i.type})`).join(", ")}`);
    return NextResponse.json(items);
  } catch (error: any) {
    console.error("Error fetching QuickBooks items:", error);

    // Se o erro for por falta de configuração, retornar itens mock
    if (error.message?.includes("not configured") || error.message?.includes("access token")) {
      console.warn("[QuickBooks] Retornando itens mock devido à falta de configuração");
      return NextResponse.json([
        {
          id: "demo-service-1",
          name: "Serviço Demo - Consultoria",
          description: "Item de serviço fictício (QuickBooks não configurado)",
          unitPrice: 1000,
          type: "Service",
        },
        {
          id: "demo-service-2",
          name: "Serviço Demo - Assessoria",
          description: "Item de serviço fictício (QuickBooks não configurado)",
          unitPrice: 500,
          type: "Service",
        },
      ]);
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch QuickBooks items" },
      { status: 500 }
    );
  }
}
