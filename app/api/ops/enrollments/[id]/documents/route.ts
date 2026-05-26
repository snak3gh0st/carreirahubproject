import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMissingOpsNativeTable, OPS_NATIVE_MIGRATION_ERROR } from "@/lib/ops/native-schema";
import {
  buildDigisacLifecycleDedupeKey,
  sendDigisacLifecycleMessageSafely,
} from "@/lib/ops/digisac-lifecycle";
import { isOperationalAccessRole } from "@/lib/roles";
import { documentStorageService } from "@/lib/services/document-storage.service";
import {
  OPS_DOCUMENT_RESOURCE_TYPES,
  OPS_DOCUMENT_STATUSES,
  OPS_STUDENT_DOCUMENT_KINDS,
  normalizeOpsVisibility,
} from "@/lib/ops/visibility";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
]);

function sanitizeFilename(raw: string): string {
  let name = raw.replace(/^.*[\\/]/, "");
  name = name.replace(/[^a-zA-Z0-9.\-_]/g, "_").replace(/_+/g, "_");
  if (name.length > 255) {
    const ext = name.lastIndexOf(".");
    name = ext > 0 ? name.slice(0, 255 - name.slice(ext).length) + name.slice(ext) : name.slice(0, 255);
  }
  return name || "document";
}

function safeSegment(raw: string | null, fallback: string) {
  const value = (raw || fallback).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return value || fallback;
}

function safeControlledValue<T extends readonly string[]>(
  raw: string | null,
  allowed: T,
  fallback: T[number],
): T[number] {
  const value = (raw || "").trim().toUpperCase();
  return allowed.includes(value) ? value : fallback;
}

function normalizeExternalUrl(raw: string | null): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  const userId = (session.user as any).id as string;
  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    select: { id: true, customerId: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const resourceType = safeControlledValue(
    formData.get("resourceType") as string | null,
    OPS_DOCUMENT_RESOURCE_TYPES,
    "FILE"
  );
  const visibility = normalizeOpsVisibility(formData.get("visibility"));
  const kind = safeControlledValue(
    formData.get("kind") as string | null,
    OPS_STUDENT_DOCUMENT_KINDS,
    "CV_ORIGINAL"
  );
  const status = safeControlledValue(
    formData.get("status") as string | null,
    OPS_DOCUMENT_STATUSES,
    "UPLOADED"
  );
  const title = ((formData.get("title") as string | null) || "").trim() || null;
  const externalUrl = normalizeExternalUrl(formData.get("externalUrl") as string | null);
  const extractedText = ((formData.get("extractedText") as string | null) || "").trim() || null;
  const notes = ((formData.get("notes") as string | null) || "").trim() || null;

  if (resourceType === "EXTERNAL_LINK") {
    if (!externalUrl) {
      return NextResponse.json({ error: "External link must be a valid http(s) URL" }, { status: 400 });
    }
  } else if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (resourceType === "FILE") {
    if (!documentStorageService.isConfigured()) {
      return NextResponse.json({ error: "Document storage is not configured" }, { status: 503 });
    }
    if (file!.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 20 MB limit" }, { status: 400 });
    }
    if (file!.type && !ALLOWED_MIME_TYPES.has(file!.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Accepted: PDF, DOC, DOCX, TXT, JPEG, PNG" },
        { status: 400 }
      );
    }
  }

  const filename = resourceType === "EXTERNAL_LINK"
    ? sanitizeFilename(title || new URL(externalUrl!).hostname)
    : sanitizeFilename(file!.name);
  let version = 1;
  try {
    const existingCount = await prisma.opsStudentDocument.count({
      where: { enrollmentId: enrollment.id, kind },
    });
    version = existingCount + 1;
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json(
        { error: OPS_NATIVE_MIGRATION_ERROR, migrationRequired: true },
        { status: 503 }
      );
    }
    throw error;
  }
  const storageKey = resourceType === "EXTERNAL_LINK"
    ? `external:${externalUrl}`
    : `ops/${enrollment.customerId}/${enrollment.id}/${kind.toLowerCase()}/${Date.now()}-${filename}`;

  if (resourceType === "FILE") {
    const buffer = Buffer.from(await file!.arrayBuffer());
    await documentStorageService.uploadObject(storageKey, buffer, {
      contentType: file!.type || "application/octet-stream",
      metadata: {
        customerId: enrollment.customerId,
        enrollmentId: enrollment.id,
        kind,
        filename,
      },
    });
  }

  try {
    const document = await prisma.opsStudentDocument.create({
      data: {
        kind,
        resourceType,
        visibility,
        status,
        title,
        filename,
        storageKey,
        externalUrl,
        mimeType: resourceType === "FILE" ? file!.type || null : "text/uri-list",
        sizeBytes: resourceType === "FILE" ? file!.size : null,
        extractedText,
        notes,
        version,
        enrollmentId: enrollment.id,
        customerId: enrollment.customerId,
        uploadedById: userId,
        reviewedAt: status === "REVIEWED" || status === "FINAL" ? new Date() : null,
        finalizedAt: status === "FINAL" ? new Date() : null,
        reviewedById: status === "REVIEWED" || status === "FINAL" ? userId : null,
      },
      include: {
        uploadedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    const digisacLifecycle = document.visibility === "STUDENT_VISIBLE"
      ? await sendDigisacLifecycleMessageSafely({
          event: "document_available",
          enrollmentId: enrollment.id,
          dedupeKey: buildDigisacLifecycleDedupeKey("document_available", document.id),
          title: document.title || document.filename,
          metadata: {
            source: "ops.enrollments.documents",
            documentId: document.id,
            kind: document.kind,
            resourceType: document.resourceType,
          },
        })
      : null;

    return NextResponse.json({ document, digisacLifecycle }, { status: 201 });
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json(
        { error: OPS_NATIVE_MIGRATION_ERROR, migrationRequired: true },
        { status: 503 }
      );
    }
    throw error;
  }
}
