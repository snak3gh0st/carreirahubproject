import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

function canUseOps(role: string | undefined) {
  return isOperationalAccessRole(role);
}

function isMissingCommentsTable(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseOps(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const comments = await prisma.opsStudentComment.findMany({
      where: { enrollmentId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      comments: comments.map((comment) => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (isMissingCommentsTable(error)) {
      return NextResponse.json({ comments: [], migrationRequired: true });
    }
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!session?.user || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseOps(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Comentario vazio" }, { status: 400 });
  if (text.length > 2000) {
    return NextResponse.json({ error: "Comentario muito longo" }, { status: 400 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  try {
    const comment = await prisma.opsStudentComment.create({
      data: {
        enrollmentId: params.id,
        authorId: userId,
        body: text,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    if (isMissingCommentsTable(error)) {
      return NextResponse.json(
        { error: "Migration de comentarios internos ainda nao foi aplicada." },
        { status: 503 }
      );
    }
    throw error;
  }
}
