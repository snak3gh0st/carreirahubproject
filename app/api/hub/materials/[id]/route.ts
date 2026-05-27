import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { documentStorageService } from "@/lib/services/document-storage.service";

export const dynamic = "force-dynamic";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = getPayload(token);
  if (!payload?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.opsStudentDocument.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      customerId: true,
      visibility: true,
      storageKey: true,
      externalUrl: true,
      filename: true,
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.customerId !== payload.customerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (doc.visibility !== "STUDENT_VISIBLE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (doc.externalUrl) {
    return NextResponse.redirect(doc.externalUrl);
  }

  if (!doc.storageKey) {
    return NextResponse.json({ error: "Material indisponível" }, { status: 404 });
  }

  try {
    const url = await documentStorageService.getPresignedUrl(doc.storageKey, 60 * 60);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[HUB_MATERIAL_DOWNLOAD]", error);
    return NextResponse.json({ error: "Erro ao gerar link" }, { status: 500 });
  }
}
