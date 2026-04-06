import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";
import { generateTempPassword, hashPassword } from "@/lib/hub-auth";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/checkout
 *
 * Public endpoint — no auth required.
 * Called from carreirausa.com "Buy Now" buttons.
 *
 * Flow:
 * 1. Validate input (name, email, program, amount)
 * 2. Find or create Customer
 * 3. Create Invoice (status: SENT, due today)
 * 4. Find or create ClientUser (with temp password)
 * 5. Return payment URL → /payment-v2/{invoiceId}
 *
 * Security: rate-limited by Vercel edge, no sensitive data exposed.
 */

const checkoutSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  programName: z.string().min(1),
  programSlug: z.string().min(1),
  phone: z.string().optional().or(z.literal("")),
  amount: z.number().positive(),
  locale: z.enum(["en", "pt"]).default("pt"),
});

const ALLOWED_ORIGINS = [
  "http://localhost:3001",
  "https://carreirausa.com",
  "https://www.carreirausa.com",
];

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  try {
    const body = await request.json();
    const data = checkoutSchema.parse(body);

    const normalizedEmail = data.email.toLowerCase().trim();

    // 1. Find or create Customer
    let customer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          email: normalizedEmail,
          name: data.name,
          phone: data.phone || undefined,
          preferredLanguage: data.locale === "pt" ? "pt-BR" : "en",
        },
      });
      console.log(`[PUBLIC_CHECKOUT] Customer created: ${customer.email}`);
    }

    // 2. Create Invoice
    const invoiceNumber = generateInvoiceNumber({
      customerName: customer.name,
      serviceName: data.programName,
      installmentType: 'single',
      amount: data.amount,
    });

    const now = new Date();
    const dueDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0)
    );

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        amount: data.amount,
        dueDate,
        status: InvoiceStatus.SENT,
        customerId: customer.id,
        lineItems: {
          items: [
            {
              description: data.programName,
              quantity: 1,
              unitPrice: data.amount,
              amount: data.amount,
            },
          ],
        },
      },
    });
    console.log(`[PUBLIC_CHECKOUT] Invoice created: ${invoice.invoiceNumber} for $${data.amount}`);

    // 3. Find or create ClientUser
    const existingClientUser = await prisma.clientUser.findUnique({
      where: { customerId: customer.id },
    });

    if (!existingClientUser) {
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      await prisma.clientUser.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          mustResetPw: true,
          tempPasswordExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h for self-service
          customerId: customer.id,
          language: data.locale === "pt" ? "pt-BR" : "en",
        },
      });
      console.log(`[PUBLIC_CHECKOUT] ClientUser created for ${normalizedEmail} — temp password: ${tempPassword}`);
      // TODO: Send welcome email with temp password via notificationService
    }

    // 4. Return payment URL
    const baseUrl = process.env.NEXTAUTH_URL || "https://carreirausa.sigmaintel.io";
    const paymentUrl = `${baseUrl}/payment-v2/${invoice.id}`;

    return NextResponse.json(
      {
        paymentUrl,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
      { status: 201, headers: cors }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.flatten().fieldErrors },
        { status: 400, headers: cors }
      );
    }

    console.error("[PUBLIC_CHECKOUT] Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500, headers: cors }
    );
  }
}
