import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

// GET /api/content?workspaceId=xxx&status=draft&unscheduled=true
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const status = searchParams.get("status");
    const unscheduled = searchParams.get("unscheduled") === "true";

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    // Get all projects in this workspace
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    // Build where clause
    const where: {
      projectId: { in: string[] };
      status?: string;
    } = {
      projectId: { in: projectIds },
    };

    if (status) {
      where.status = status;
    }

    // If unscheduled=true, only get content without schedules
    let contentPieces;
    if (unscheduled) {
      // Get content pieces that don't have any schedules
      contentPieces = await prisma.contentPiece.findMany({
        where: {
          ...where,
          schedules: {
            none: {},
          },
        },
        include: {
          project: {
            select: { name: true },
          },
          platformContents: {
            select: { platform: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      contentPieces = await prisma.contentPiece.findMany({
        where,
        include: {
          project: {
            select: { name: true },
          },
          platformContents: {
            select: { platform: true },
            take: 1,
          },
          schedules: {
            orderBy: { scheduledAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Transform to match UnscheduledPanel interface
    const items = contentPieces.map((piece) => ({
      id: piece.id,
      title: piece.title,
      type: piece.type,
      platform: piece.platformContents?.[0]?.platform || "generic", // Fallback to "generic" if no platform
      status: piece.status,
      createdAt: piece.createdAt.toISOString(),
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching content:", error);
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
  }
}
