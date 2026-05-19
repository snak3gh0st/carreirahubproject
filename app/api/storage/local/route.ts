import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getHubAuth } from "@/lib/hub-auth";
import { isOperationalAccessRole } from "@/lib/roles";
import { documentStorageService } from "@/lib/services/document-storage.service";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function getContentType(storageKey: string): string {
  return CONTENT_TYPES[path.posix.extname(storageKey).toLowerCase()] || "application/octet-stream";
}

function getSafeFilename(storageKey: string): string {
  return path.posix.basename(storageKey).replace(/[^a-zA-Z0-9.\-_]/g, "_") || "document";
}

async function hubCanAccessStorageKey(storageKey: string, customerId: string): Promise<boolean> {
  if (storageKey.startsWith(`forms/${customerId}/`)) {
    return true;
  }

  const contract = await prisma.contract.findFirst({
    where: {
      customerId,
      signedS3Key: storageKey,
    },
    select: { id: true },
  });

  return Boolean(contract);
}

export async function GET(request: NextRequest) {
  const storageKey = request.nextUrl.searchParams.get("key");
  if (!storageKey) {
    return NextResponse.json({ error: "Missing storage key" }, { status: 400 });
  }

  if (!documentStorageService.isConfigured()) {
    return NextResponse.json(
      { error: "Document storage is not configured" },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (session) {
    const role = (session.user as { role?: string } | undefined)?.role;
    if (!isOperationalAccessRole(role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const hubAuth = await getHubAuth(request);
    if (!hubAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await hubCanAccessStorageKey(storageKey, hubAuth.customerId);
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const file = await documentStorageService.downloadDocument(storageKey);
    const filename = getSafeFilename(storageKey);
    const disposition = request.nextUrl.searchParams.get("download") === "1"
      ? "attachment"
      : "inline";

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": getContentType(storageKey),
        "Content-Length": String(file.length),
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error: any) {
    const message = error?.message || "";
    if (message.includes("Invalid storage key")) {
      return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
    }
    if (message.includes("Document not found")) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    console.error("[Storage] Error downloading document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
