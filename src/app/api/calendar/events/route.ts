import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

// GET /api/calendar/events - Get scheduled content for calendar view
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");

  if (!start || !end) {
    return NextResponse.json(
      { error: "invalid_input", message: "start and end are required" },
      { status: 400 }
    );
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  try {
    const where: any = {
      scheduledAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Build workspace filter
    const projectFilter: any = {
      project: {
        workspaceId: ws.workspaceId,
      },
    };

    // Add projectId filter if provided
    if (projectId) {
      projectFilter.project.id = projectId;
    }

    // Add status filter if provided
    if (status) {
      projectFilter.contentPiece = { status };
    }

    // Combine with date filter using AND
    where.AND = [projectFilter];

    const schedules = await prisma.contentSchedule.findMany({
      where,
      include: {
        contentPiece: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
