import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Debug endpoint to check database connection
 */
export async function GET() {
  try {
    // Get database URL (masked for security)
    const dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "NOT SET";
    const maskedUrl = dbUrl.substring(0, 30) + "..." + dbUrl.substring(dbUrl.length - 20);

    // Try to query a user
    const userCount = await prisma.user.count();
    const admin = await prisma.user.findUnique({
      where: { email: "admin@carreirausa.com" },
      select: {
        id: true,
        email: true,
        active: true,
        password: true,
      }
    });

    return NextResponse.json({
      database: {
        url: maskedUrl,
        connected: true,
      },
      users: {
        total: userCount,
      },
      admin: {
        exists: !!admin,
        email: admin?.email,
        active: admin?.active,
        hasPassword: !!admin?.password,
        passwordHash: admin?.password ? admin.password.substring(0, 30) + "..." : null,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL ? "yes" : "no",
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
