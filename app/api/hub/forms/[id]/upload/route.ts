import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ---------------------------------------------------------------------------
// S3 Client (lazy singleton)
// ---------------------------------------------------------------------------

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a filename: strip path separators, replace special characters,
 * and limit to 255 characters.
 */
function sanitizeFilename(raw: string): string {
  // Strip directory components
  let name = raw.replace(/^.*[\\/]/, "");
  // Replace anything that is not alphanumeric, dot, hyphen, or underscore
  name = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  // Collapse consecutive underscores
  name = name.replace(/_+/g, "_");
  // Limit length
  if (name.length > 255) {
    const ext = name.lastIndexOf(".");
    if (ext > 0) {
      const extension = name.slice(ext);
      name = name.slice(0, 255 - extension.length) + extension;
    } else {
      name = name.slice(0, 255);
    }
  }
  return name || "upload";
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * POST /api/hub/forms/[id]/upload
 * Upload a file for a form field.
 *
 * Accepts multipart/form-data with fields:
 *   - file: File
 *   - fieldId: string
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fieldId = formData.get("fieldId") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file" },
        { status: 400 }
      );
    }

    if (!fieldId || typeof fieldId !== "string") {
      return NextResponse.json(
        { error: "Missing fieldId" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10 MB limit" },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: "File type not allowed. Accepted: PDF, JPEG, PNG, DOC, DOCX",
        },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.name);

    // Build S3 key
    const s3Key = `forms/${auth.customerId}/${id}/${fieldId}/${sanitizedFilename}`;

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    return NextResponse.json({
      key: s3Key,
      filename: sanitizedFilename,
    });
  } catch (error) {
    console.error("[Hub Forms] Error uploading file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
